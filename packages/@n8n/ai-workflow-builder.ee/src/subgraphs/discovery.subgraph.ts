/**
 * Discovery Subgraph
 *
 * Runs node discovery and (optionally) plan generation/approval.
 * Uses LangChain v1 createAgent APIs for both discovery and planner agents.
 */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import type { RunnableConfig } from '@langchain/core/runnables';
import { Annotation, END, START, StateGraph, interrupt } from '@langchain/langgraph';
import type { Logger } from '@n8n/backend-common';
import type { INodeTypeDescription } from 'n8n-workflow';

import {
	createDiscoveryAgent,
	discoveryOutputSchema,
	type DiscoveryAgentType,
	type DiscoveryOutput,
} from '@/agents/discovery.agent';
import {
	createPlannerAgent,
	plannerOutputSchema,
	type PlannerAgentType,
} from '@/agents/planner.agent';
import type { ParentGraphState } from '@/parent-graph-state';
import type { BuilderFeatureFlags } from '@/workflow-builder-agent';
import type { CoordinationLogEntry } from '@/types/coordination';
import { createDiscoveryMetadata } from '@/types/coordination';
import type { DiscoveryContext } from '@/types/discovery-types';
import type { PlanDecision, PlanOutput } from '@/types/planning';
import type { WorkflowMetadata } from '@/types/tools';
import type { SimpleWorkflow } from '@/types/workflow';
import { buildWorkflowSummary, createContextMessage } from '@/utils/context-builders';
import {
	createResourceCacheKey,
	extractResourceOperations,
	type ResourceOperationInfo,
} from '@/utils/resource-operation-extractor';
import { extractUserRequest } from '@/utils/subgraph-helpers';

import { BaseSubgraph } from './subgraph-interface';

function formatPlanForContext(plan: PlanOutput): string {
	const lines: string[] = [];
	lines.push(`Summary: ${plan.summary}`);
	lines.push(`Trigger: ${plan.trigger}`);
	lines.push('');
	lines.push('Steps:');
	plan.steps.forEach((step, index) => {
		lines.push(`${index + 1}. ${step.description}`);
		if (step.subSteps?.length) {
			step.subSteps.forEach((subStep) => lines.push(`   - ${subStep}`));
		}
		if (step.suggestedNodes?.length) {
			lines.push(`   Suggested nodes: ${step.suggestedNodes.join(', ')}`);
		}
	});

	if (plan.additionalSpecs?.length) {
		lines.push('');
		lines.push('Additional specs / assumptions:');
		plan.additionalSpecs.forEach((spec) => lines.push(`- ${spec}`));
	}

	return lines.join('\n');
}

function parsePlanDecision(value: unknown): { action: PlanDecision; feedback?: string } {
	if (typeof value !== 'object' || value === null) {
		return { action: 'reject', feedback: 'Invalid response: expected an object.' };
	}

	const obj = value as Record<string, unknown>;
	const action = obj.action;
	if (action !== 'approve' && action !== 'reject' && action !== 'modify') {
		return {
			action: 'reject',
			feedback: 'Invalid response: expected action to be approve/reject/modify.',
		};
	}

	const feedback = typeof obj.feedback === 'string' ? obj.feedback : undefined;
	return { action, ...(feedback ? { feedback } : {}) };
}

export interface DiscoverySubgraphConfig {
	parsedNodeTypes: INodeTypeDescription[];
	llm: BaseChatModel;
	plannerLLM: BaseChatModel;
	logger?: Logger;
	featureFlags?: BuilderFeatureFlags;
}

interface DiscoverySubgraphInput {
	userRequest: string;
	workflowJSON: SimpleWorkflow;
	mode: 'build' | 'plan';
	planOutput: PlanOutput | null;
}

interface DiscoverySubgraphOutput extends Record<string, unknown> {
	discoveryContext: DiscoveryContext;
	coordinationLog: CoordinationLogEntry[];
	templateIds: number[];
	cachedTemplates: WorkflowMetadata[];
	planOutput: PlanOutput | null;
	planDecision: PlanDecision | null;
	mode?: 'build' | 'plan';
}

const DiscoverySubgraphState = Annotation.Root({
	userRequest: Annotation<string>({
		reducer: (x, y) => y ?? x,
		default: () => '',
	}),
	workflowJSON: Annotation<SimpleWorkflow>({
		reducer: (x, y) => y ?? x,
		default: () => ({ nodes: [], connections: {}, name: '' }),
	}),
	mode: Annotation<'build' | 'plan'>({
		reducer: (x, y) => y ?? x,
		default: () => 'build',
	}),
	planOutput: Annotation<PlanOutput | null>({
		reducer: (x, y) => (y === undefined ? x : y),
		default: () => null,
	}),
	planDecision: Annotation<PlanDecision | null>({
		reducer: (x, y) => (y === undefined ? x : y),
		default: () => null,
	}),
	planFeedback: Annotation<string | null>({
		reducer: (x, y) => (y === undefined ? x : y),
		default: () => null,
	}),
	planPrevious: Annotation<PlanOutput | null>({
		reducer: (x, y) => (y === undefined ? x : y),
		default: () => null,
	}),
	discoveryContext: Annotation<DiscoveryContext | null>({
		reducer: (x, y) => y ?? x,
		default: () => null,
	}),
});

export class DiscoverySubgraph extends BaseSubgraph<
	DiscoverySubgraphConfig,
	typeof DiscoverySubgraphState.State,
	typeof ParentGraphState.State
> {
	name = 'discovery_subgraph';
	description = 'Discovers relevant nodes and proposes a plan when needed';

	private discoveryAgent!: DiscoveryAgentType;
	private plannerAgent!: PlannerAgentType;
	private nodeTypeMap = new Map<string, INodeTypeDescription>();
	private resourceOperationCache = new Map<string, ResourceOperationInfo | null>();
	private logger?: Logger;
	private featureFlags?: BuilderFeatureFlags;

	create(config: DiscoverySubgraphConfig) {
		this.logger = config.logger;
		this.featureFlags = config.featureFlags;
		this.discoveryAgent = createDiscoveryAgent({
			llm: config.llm,
			parsedNodeTypes: config.parsedNodeTypes,
			featureFlags: config.featureFlags,
			logger: config.logger,
		});
		this.plannerAgent = createPlannerAgent({ llm: config.plannerLLM });

		this.nodeTypeMap.clear();
		for (const nt of config.parsedNodeTypes) {
			const versions = Array.isArray(nt.version) ? nt.version : [nt.version];
			for (const v of versions) {
				this.nodeTypeMap.set(`${nt.name}:${v}`, nt);
			}
		}

		this.resourceOperationCache.clear();

		const discoveryNode = async (
			state: typeof DiscoverySubgraphState.State,
			runnableConfig?: RunnableConfig,
		) => {
			console.log('[plan-debug] discovery_agent', {
				mode: state.mode,
				hasPlanOutput: Boolean(state.planOutput),
				nodeCount: state.workflowJSON.nodes.length,
				hasPlanFeedback: Boolean(state.planFeedback),
			});

			const userRequest = state.userRequest || 'Build a workflow';
			const discoveryContext = await this.runDiscovery(
				userRequest,
				state.workflowJSON,
				state.planFeedback,
				state.planPrevious,
				runnableConfig,
			);
			console.log('[plan-debug] discovery_context', {
				nodesFound: discoveryContext.nodesFound.length,
				nodeNames: discoveryContext.nodesFound.map((node) => node.nodeName),
				hasPlanFeedback: Boolean(state.planFeedback),
				hasPlanPrevious: Boolean(state.planPrevious),
			});

			return { discoveryContext };
		};

		const plannerNode = async (
			state: typeof DiscoverySubgraphState.State,
			runnableConfig?: RunnableConfig,
		) => {
			if (!this.featureFlags?.planMode || state.mode !== 'plan' || state.planOutput) {
				return {};
			}

			const userRequest = state.userRequest || 'Build a workflow';
			const discoveryContext = state.discoveryContext ?? { nodesFound: [] };
			console.log('[plan-debug] planner.context', {
				hasDiscoveryContext: discoveryContext.nodesFound.length > 0,
				discoveredNodes: discoveryContext.nodesFound.length,
				hasPlanPrevious: Boolean(state.planPrevious),
				hasPlanFeedback: Boolean(state.planFeedback),
			});

			const contextParts: string[] = [];
			contextParts.push('=== USER REQUEST ===');
			contextParts.push(userRequest);

			if (discoveryContext.nodesFound.length > 0) {
				contextParts.push('=== DISCOVERY CONTEXT (SUGGESTED NODES) ===');
				contextParts.push(
					discoveryContext.nodesFound
						.map((n) => `- ${n.nodeName} v${n.version}: ${n.reasoning}`)
						.join('\n'),
				);
			}

			if (state.workflowJSON.nodes.length > 0) {
				contextParts.push('=== EXISTING WORKFLOW SUMMARY ===');
				contextParts.push(buildWorkflowSummary(state.workflowJSON));
			}

			if (state.planPrevious) {
				contextParts.push('=== PREVIOUS PLAN ===');
				contextParts.push(formatPlanForContext(state.planPrevious));
			}

			if (state.planFeedback) {
				contextParts.push('=== USER FEEDBACK ===');
				contextParts.push(state.planFeedback);
			}

			const contextMessage = createContextMessage(contextParts);
			const output = await this.plannerAgent.invoke({ messages: [contextMessage] }, runnableConfig);
			const parsedPlan = plannerOutputSchema.safeParse(output.structuredResponse);
			if (!parsedPlan.success) {
				throw new Error(`Planner produced invalid output: ${parsedPlan.error.message}`);
			}

			const plan = parsedPlan.data;
			console.log('[plan-debug] planner.interrupt', {
				stepCount: plan.steps.length,
				summary: plan.summary,
			});
			const decisionValue: unknown = interrupt({
				type: 'plan',
				plan,
			});

			const decision = parsePlanDecision(decisionValue);
			console.log('[plan-debug] planner.decision', decision);

			if (decision.action === 'approve') {
				return {
					planDecision: 'approve' as const,
					planOutput: plan,
					mode: 'build' as const,
					planFeedback: null,
					planPrevious: null,
				};
			}

			if (decision.action === 'reject') {
				return {
					planDecision: 'reject' as const,
					planOutput: null,
					planFeedback: null,
					planPrevious: null,
				};
			}

			return {
				planDecision: 'modify' as const,
				planOutput: null,
				planFeedback: decision.feedback ?? 'User requested changes without additional details.',
				planPrevious: plan,
			};
		};

		const shouldPlan = (state: typeof DiscoverySubgraphState.State): 'planner' | typeof END => {
			if (!this.featureFlags?.planMode) return END;
			if (state.mode !== 'plan') return END;
			return state.planOutput ? END : 'planner';
		};

		const shouldLoopPlanner = (
			state: typeof DiscoverySubgraphState.State,
		): 'discovery_agent' | typeof END => {
			return state.planDecision === 'modify' ? 'discovery_agent' : END;
		};

		const subgraph = new StateGraph(DiscoverySubgraphState)
			.addNode('discovery_agent', discoveryNode)
			.addNode('planner', plannerNode)
			.addEdge(START, 'discovery_agent')
			.addConditionalEdges('discovery_agent', shouldPlan)
			.addConditionalEdges('planner', shouldLoopPlanner);

		return subgraph.compile();
	}

	transformInput(parentState: typeof ParentGraphState.State) {
		const userRequest = extractUserRequest(parentState.messages, 'Build a workflow');

		return {
			userRequest,
			workflowJSON: parentState.workflowJSON,
			mode: parentState.mode,
			planOutput: parentState.planOutput,
			planDecision: null,
			planFeedback: null,
			planPrevious: null,
		};
	}

	transformOutput(
		childOutput: typeof DiscoverySubgraphState.State,
		_parentState: typeof ParentGraphState.State,
	) {
		const discoveryContext = childOutput.discoveryContext ?? { nodesFound: [] };
		console.log('[plan-debug] discovery_output', {
			nodesFound: discoveryContext.nodesFound.length,
			planDecision: childOutput.planDecision,
			hasPlanOutput: Boolean(childOutput.planOutput),
			mode: childOutput.mode,
		});
		const logEntry: CoordinationLogEntry = {
			phase: 'discovery',
			status: 'completed',
			timestamp: Date.now(),
			summary: `Discovered ${discoveryContext.nodesFound.length} nodes`,
			metadata: createDiscoveryMetadata({
				nodesFound: discoveryContext.nodesFound.length,
				nodeTypes: discoveryContext.nodesFound.map((n) => n.nodeName),
				hasBestPractices: false,
			}),
		};

		return {
			discoveryContext,
			coordinationLog: [logEntry],
			templateIds: [],
			cachedTemplates: [],
			planOutput: childOutput.planOutput,
			planDecision: childOutput.planDecision,
			...(childOutput.mode ? { mode: childOutput.mode } : {}),
		};
	}

	private async runDiscovery(
		userRequest: string,
		workflowJSON: SimpleWorkflow,
		planFeedback: string | null,
		planPrevious: PlanOutput | null,
		runnableConfig?: RunnableConfig,
	): Promise<DiscoveryContext> {
		const contextParts: string[] = [];

		contextParts.push('<user_request>');
		contextParts.push(userRequest);
		contextParts.push('</user_request>');

		if (planPrevious) {
			contextParts.push('<previous_plan>');
			contextParts.push(formatPlanForContext(planPrevious));
			contextParts.push('</previous_plan>');
		}

		if (planFeedback) {
			contextParts.push('<plan_feedback>');
			contextParts.push(planFeedback);
			contextParts.push('</plan_feedback>');
		}

		if (workflowJSON.nodes.length > 0) {
			contextParts.push('<existing_workflow_summary>');
			contextParts.push(buildWorkflowSummary(workflowJSON));
			contextParts.push('</existing_workflow_summary>');
		}

		const contextMessage = createContextMessage(contextParts);
		const result = await this.discoveryAgent.invoke({ messages: [contextMessage] }, runnableConfig);
		const parsed = discoveryOutputSchema.safeParse(result.structuredResponse as DiscoveryOutput);
		if (!parsed.success) {
			throw new Error(`Discovery produced invalid output: ${parsed.error.message}`);
		}

		const hydratedNodesFound = parsed.data.nodesFound.map((node) => {
			const cacheKey = createResourceCacheKey(node.nodeName, node.version);
			if (this.resourceOperationCache.has(cacheKey)) {
				const cached = this.resourceOperationCache.get(cacheKey);
				return cached ? { ...node, availableResources: cached.resources } : node;
			}

			const nodeType = this.nodeTypeMap.get(cacheKey);
			if (!nodeType) {
				this.logger?.warn('[Discovery] Node type not found during resource hydration', {
					nodeName: node.nodeName,
					nodeVersion: node.version,
				});
				this.resourceOperationCache.set(cacheKey, null);
				return node;
			}

			const resourceOpInfo = extractResourceOperations(nodeType, node.version, this.logger);
			this.resourceOperationCache.set(cacheKey, resourceOpInfo);
			if (!resourceOpInfo) return node;

			return {
				...node,
				availableResources: resourceOpInfo.resources,
			};
		});

		return {
			nodesFound: hydratedNodesFound,
			bestPractices: undefined,
		};
	}
}
