/**
 * Planner Agent Prompt
 *
 * Generates a structured workflow plan for user approval (Plan Mode).
 */

import type { DiscoveryContext } from '@/types/discovery-types';
import type { PlanOutput } from '@/types/planning';
import type { SimpleWorkflow } from '@/types/workflow';
import { formatPlanAsText } from '@/utils/plan-helpers';

import { prompt } from '../builder';

const ROLE = `You are a Planner Agent for n8n AI Workflow Builder.
Create a clear implementation plan that the builder can follow to construct the workflow.`;

const GOAL = `Your goal is to propose an implementation plan the user can approve before any workflow is built.
Use the user's request and the discovery context (suggested node types) to produce a practical plan.`;

const BEST_PRACTICES_TOOL = `Before writing the plan, use the get_documentation tool to retrieve best practices for the relevant workflow techniques. This gives you proven n8n patterns, recommended node architectures, and common pitfalls to avoid.

For example, if the user wants a notification workflow, fetch best practices for "notification". If it involves scheduling, fetch "scheduling". Match the techniques to the user's use case.

Available techniques: trigger, loop, branch, subroutine, pagination, parallel_execution, error_handling, scheduling, rate_limiting, batch_processing, ai_agent, ai_chain, rag, data_transformation, http_request, chatbot, content_generation, data_extraction, data_persistence, document_processing, form_input, notification, triage, scraping_and_research, monitoring, enrichment, knowledge_base, human_in_the_loop, data_analysis.`;

const RULES = `Rules:
- Do not generate workflow JSON.
- Do not invent unknown n8n node type names. Only suggest node type names when you are confident (prefer those in the discovery context).
- Keep steps actionable and ordered.
- If key information is missing, make reasonable assumptions and list them in additionalSpecs.`;

const OUTPUT_FORMAT = `Output format:
- summary: 1–2 sentences describing the workflow outcome
- trigger: what starts the workflow
- steps: ordered list of steps; each step should describe what happens and may include suggestedNodes
- additionalSpecs: optional list of assumptions, edge cases, or notes`;

export function buildPlannerPrompt(options?: { hasDocumentationTool?: boolean }): string {
	return prompt()
		.section('role', ROLE)
		.section('goal', GOAL)
		.sectionIf(options?.hasDocumentationTool, 'best_practices_tool', BEST_PRACTICES_TOOL)
		.section('rules', RULES)
		.section('output_format', OUTPUT_FORMAT)
		.build();
}

export interface PlannerContextOptions {
	userRequest: string;
	discoveryContext: DiscoveryContext;
	workflowJSON: SimpleWorkflow;
	planPrevious?: PlanOutput | null;
	planFeedback?: string | null;
}

/**
 * Build the planner's context message content using PromptBuilder.
 * Composes user request, discovery results, workflow state, and optional
 * feedback from a previous modify cycle.
 */
export function buildPlannerContext(options: PlannerContextOptions): string {
	const { userRequest, discoveryContext, workflowJSON, planPrevious, planFeedback } = options;

	const discoveredNodesList = discoveryContext.nodesFound
		.map((node) => `- ${node.nodeName} v${node.version}: ${node.reasoning}`)
		.join('\n');

	const workflowSummary = workflowJSON.nodes.map((n) => `- ${n.name} (${n.type})`).join('\n');

	return prompt()
		.section('user_request', userRequest)
		.sectionIf(
			discoveryContext.nodesFound.length > 0,
			'discovery_context_suggested_nodes',
			discoveredNodesList,
		)
		.sectionIf(workflowJSON.nodes.length > 0, 'existing_workflow_summary', workflowSummary)
		.sectionIf(planPrevious, 'previous_plan', () => formatPlanAsText(planPrevious!))
		.sectionIf(planFeedback, 'user_feedback', () => planFeedback!)
		.build();
}
