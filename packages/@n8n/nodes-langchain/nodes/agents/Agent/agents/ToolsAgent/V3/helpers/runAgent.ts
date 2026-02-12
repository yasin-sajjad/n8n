import type { AgentRunnableSequence } from '@langchain/classic/agents';
import type { BaseChatMemory } from '@langchain/classic/memory';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import {
	buildResponseMetadata,
	createEngineRequests,
	loadMemory,
	processEventStream,
	saveToMemory,
	type RequestResponseMetadata,
	type ToolCallRequest,
} from '@utils/agent-execution';
import { getTracingConfig } from '@utils/tracing';
import type {
	EngineRequest,
	EngineResponse,
	IExecuteFunctions,
	ISupplyDataFunctions,
} from 'n8n-workflow';

import { SYSTEM_MESSAGE } from '../../prompt';
import type { AgentResult } from '../types';
import type { ItemContext } from './prepareItemContext';

export type ActivationResult = {
	type: 'activation';
	activationCalls: ToolCallRequest[];
};

type RunAgentResult = AgentResult | EngineRequest<RequestResponseMetadata> | ActivationResult;

/**
 * Checks if any tool calls are for skill activation tools, and if so returns
 * an ActivationResult instead of creating engine requests.
 */
function checkForActivationCalls(
	toolCalls: ToolCallRequest[],
	tools: ItemContext['tools'],
): ActivationResult | null {
	const activationCalls = toolCalls.filter((tc) => {
		const foundTool = tools.find((t) => t.name === tc.tool);
		return foundTool?.metadata?.isActivationTool === true;
	});

	if (activationCalls.length > 0) {
		return { type: 'activation', activationCalls };
	}
	return null;
}

/**
 * Runs the agent for a single item, choosing between streaming or non-streaming execution.
 * Handles both regular execution and execution after tool calls.
 * Intercepts skill activation tool calls before they reach createEngineRequests().
 *
 * @param ctx - The execution context
 * @param executor - The agent runnable sequence
 * @param itemContext - Context for the current item
 * @param model - The chat model for token counting
 * @param memory - Optional memory for conversation context
 * @param response - Optional engine response with previous tool calls
 * @returns AgentResult, engine request with tool calls, or ActivationResult
 */
export async function runAgent(
	ctx: IExecuteFunctions | ISupplyDataFunctions,
	executor: AgentRunnableSequence,
	itemContext: ItemContext,
	model: BaseChatModel,
	memory: BaseChatMemory | undefined,
	response?: EngineResponse<RequestResponseMetadata>,
): Promise<RunAgentResult> {
	const { itemIndex, input, steps, tools, options } = itemContext;

	const invokeParams = {
		// steps are passed to the ToolCallingAgent in the runnable sequence to keep track of tool calls
		steps,
		input,
		system_message: options.systemMessage ?? SYSTEM_MESSAGE,
		formatting_instructions:
			'IMPORTANT: For your response to user, you MUST use the `format_final_json_response` tool with your complete answer formatted according to the required schema. Do not attempt to format the JSON manually - always use this tool. Your response will be rejected if it is not properly formatted through this tool. Only use this tool once you are ready to provide your final answer.',
	};
	const executeOptions = { signal: ctx.getExecutionCancelSignal() };

	// Check if streaming is actually available
	const isStreamingAvailable = 'isStreaming' in ctx ? ctx.isStreaming?.() : undefined;

	if (
		'isStreaming' in ctx &&
		options.enableStreaming &&
		isStreamingAvailable &&
		ctx.getNode().typeVersion >= 2.1
	) {
		const chatHistory = await loadMemory(memory, model, options.maxTokensFromMemory);
		const eventStream = executor.withConfig(getTracingConfig(ctx)).streamEvents(
			{
				...invokeParams,
				chat_history: chatHistory,
			},
			{
				version: 'v2',
				...executeOptions,
			},
		);

		const result = await processEventStream(ctx, eventStream, itemIndex);

		// If result contains tool calls, check for activation tools first
		if (result.toolCalls && result.toolCalls.length > 0) {
			const activation = checkForActivationCalls(result.toolCalls, tools);
			if (activation) return activation;

			const actions = createEngineRequests(result.toolCalls, itemIndex, tools);

			return {
				actions,
				metadata: buildResponseMetadata(response, itemIndex),
			};
		}
		// Save conversation to memory including any tool call context
		if (memory && input && result?.output) {
			const previousCount = response?.metadata?.previousRequests?.length;
			await saveToMemory(input, result.output, memory, steps, previousCount);
		}

		if (options.returnIntermediateSteps && steps.length > 0) {
			result.intermediateSteps = steps;
		}

		return result;
	} else {
		// Handle regular execution
		const chatHistory = await loadMemory(memory, model, options.maxTokensFromMemory);

		const modelResponse = await executor.withConfig(getTracingConfig(ctx)).invoke({
			...invokeParams,
			chat_history: chatHistory,
		});

		if ('returnValues' in modelResponse) {
			// Save conversation to memory including any tool call context
			if (memory && input && modelResponse.returnValues.output) {
				const previousCount = response?.metadata?.previousRequests?.length;
				await saveToMemory(input, modelResponse.returnValues.output, memory, steps, previousCount);
			}
			// Include intermediate steps if requested
			const result = { ...modelResponse.returnValues };
			if (options.returnIntermediateSteps && steps.length > 0) {
				result.intermediateSteps = steps;
			}
			return result;
		}

		// Check for activation tool calls before creating engine requests
		const activation = checkForActivationCalls(modelResponse as ToolCallRequest[], tools);
		if (activation) return activation;

		// If response contains tool calls, we need to return this in the right format
		const actions = createEngineRequests(modelResponse, itemIndex, tools);

		return {
			actions,
			metadata: buildResponseMetadata(response, itemIndex),
		};
	}
}
