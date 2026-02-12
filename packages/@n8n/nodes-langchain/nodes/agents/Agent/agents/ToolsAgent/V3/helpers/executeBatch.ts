import type { AgentRunnableSequence } from '@langchain/classic/agents';
import type { BaseChatMemory } from '@langchain/classic/memory';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import { NodeOperationError, assertParamIsNumber, nodeNameToToolName } from 'n8n-workflow';
import type {
	IExecuteFunctions,
	ISupplyDataFunctions,
	INodeExecutionData,
	EngineResponse,
	EngineRequest,
} from 'n8n-workflow';

import { processHitlResponses } from '@utils/agent-execution';
import type {
	RequestResponseMetadata,
	ToolCallData,
	ToolCallRequest,
} from '@utils/agent-execution/types';
import { getOptionalOutputParser } from '@utils/output_parsers/N8nOutputParser';

import { getConnectedSkills } from '../../common';
import type { SkillData } from '../../../../../../skills/types';
import type { AgentResult } from '../types';
import { createAgentSequence } from './createAgentSequence';
import { finalizeResult } from './finalizeResult';
import { prepareItemContext } from './prepareItemContext';
import { runAgent, type ActivationResult } from './runAgent';
import { checkMaxIterations } from './checkMaxIterations';

type BatchResult = AgentResult | EngineRequest<RequestResponseMetadata>;

/**
 * Builds a synthetic ToolCallData step representing a skill activation.
 * This step is included in the conversation history so the agent sees
 * the activation as a prior tool call/response exchange.
 */
function buildActivationStep(call: ToolCallRequest, skill: SkillData): ToolCallData {
	return {
		action: {
			tool: call.tool,
			toolInput: call.toolInput,
			log: `Activating skill: ${skill.name}`,
			messageLog: [
				new AIMessage({
					content: `Activating skill: ${skill.name}`,
					tool_calls: [
						{
							id: call.toolCallId,
							name: call.tool,
							args: call.toolInput,
							type: 'tool_call' as const,
						},
					],
				}),
			],
			toolCallId: call.toolCallId,
			type: 'tool_call',
		},
		observation: `Skill "${skill.name}" activated.\n\n${skill.instructions}`,
	};
}

/**
 * Type guard to check if a result is an ActivationResult
 */
function isActivationResult(result: unknown): result is ActivationResult {
	return (
		typeof result === 'object' &&
		result !== null &&
		'type' in result &&
		(result as ActivationResult).type === 'activation'
	);
}

/**
 * Executes a batch of items, handling both successful execution and errors.
 * Applies continue-on-fail logic when errors occur.
 * Supports progressive disclosure of skills via activation loop.
 *
 * @param ctx - The execution context
 * @param batch - Array of items to process in this batch
 * @param startIndex - Starting index of the batch in the original items array (used to calculate itemIndex)
 * @param model - Primary chat model
 * @param fallbackModel - Optional fallback model
 * @param memory - Optional memory for conversation context
 * @param response - Optional engine response with previous tool calls
 * @returns Object containing execution data and optional requests
 */
export async function executeBatch(
	ctx: IExecuteFunctions | ISupplyDataFunctions,
	batch: INodeExecutionData[],
	startIndex: number,
	model: BaseChatModel,
	fallbackModel: BaseChatModel | null,
	memory: BaseChatMemory | undefined,
	response?: EngineResponse<RequestResponseMetadata>,
): Promise<{
	returnData: INodeExecutionData[];
	request: EngineRequest<RequestResponseMetadata> | undefined;
}> {
	const returnData: INodeExecutionData[] = [];
	let request: EngineRequest<RequestResponseMetadata> | undefined = undefined;

	// Process HITL (Human-in-the-Loop) tool responses before running the agent
	// If there are approved HITL tools, we need to execute the gated tools first
	const hitlResult = processHitlResponses(response, startIndex);

	if (hitlResult.hasApprovedHitlTools && hitlResult.pendingGatedToolRequest) {
		// Return the gated tool request immediately
		// The Agent will resume after the gated tool executes
		return {
			returnData: [],
			request: hitlResult.pendingGatedToolRequest,
		};
	}

	// Use the processed response (with HITL denials properly formatted)
	const processedResponse = hitlResult.processedResponse;

	// Check max iterations if this is a continuation of a previous execution
	const maxIterations = ctx.getNodeParameter('options.maxIterations', 0, 10);
	assertParamIsNumber('options.maxIterations', maxIterations, ctx.getNode());

	// Load connected skills for progressive disclosure
	const allSkills = await getConnectedSkills(ctx);

	// Restore activation state from previous engine invocations
	const activatedSkillNames = new Set<string>(response?.metadata?.activatedSkills ?? []);
	const activationSteps: ToolCallData[] = [...(response?.metadata?.activationSteps ?? [])];

	const batchPromises = batch.map(async (_item, batchItemIndex) => {
		const itemIndex = startIndex + batchItemIndex;

		checkMaxIterations(response, maxIterations, ctx.getNode());

		// Activation loop: re-invoke agent after each skill activation
		// eslint-disable-next-line no-constant-condition
		while (true) {
			const itemContext = await prepareItemContext(
				ctx,
				itemIndex,
				processedResponse,
				allSkills,
				activatedSkillNames,
				activationSteps,
			);

			const { tools, prompt, options, outputParser } = itemContext;

			// Create executors for primary and fallback models
			const executor: AgentRunnableSequence = createAgentSequence(
				model,
				tools,
				prompt,
				options,
				outputParser,
				memory,
				fallbackModel,
			);

			// Run the agent with processed response
			const result = await runAgent(ctx, executor, itemContext, model, memory, processedResponse);

			if (isActivationResult(result)) {
				// Handle activation: mark skills as activated, build synthetic steps
				for (const call of result.activationCalls) {
					const toolName = call.tool.replace(/^activate_skill_/, '');
					const skill = allSkills.find((s) => nodeNameToToolName(s.name) === toolName);
					if (skill) {
						activatedSkillNames.add(skill.name);
						activationSteps.push(buildActivationStep(call, skill));
						// Record execution data so the skill node gets the green outline
						skill.recordExecution?.();
					}
				}
				// Loop back — re-invoke with activated skills
				continue;
			}

			// Not an activation — return normally
			return result;
		}
	});

	const batchResults = await Promise.allSettled(batchPromises);
	// This is only used to check if the output parser is connected
	// so we can parse the output if needed. Actual output parsing is done in the loop above
	const outputParser = await getOptionalOutputParser(ctx, 0);

	batchResults.forEach((result, index) => {
		const itemIndex = startIndex + index;
		if (result.status === 'rejected') {
			const error = result.reason as Error;
			if (ctx.continueOnFail()) {
				returnData.push({
					json: { error: error.message },
					pairedItem: { item: itemIndex },
				} as INodeExecutionData);
				return;
			} else {
				throw new NodeOperationError(ctx.getNode(), error);
			}
		}
		const batchResult = result.value as BatchResult;

		if (!batchResult) {
			return;
		}

		if ('actions' in batchResult) {
			// Store activation state in metadata for cross-invocation persistence
			if (activatedSkillNames.size > 0) {
				batchResult.metadata.activatedSkills = [...activatedSkillNames];
				batchResult.metadata.activationSteps = activationSteps;
			}

			if (!request) {
				request = {
					actions: batchResult.actions,
					metadata: batchResult.metadata,
				};
			} else {
				request.actions.push.apply(request.actions, batchResult.actions);
			}
			return;
		}

		// Finalize the result
		const itemResult = finalizeResult(batchResult, itemIndex, memory, outputParser);
		returnData.push(itemResult);
	});

	return { returnData, request };
}
