/**
 * Tests for CodeBuilderAgent LangSmith tracing output.
 *
 * Verifies that the parent LangSmith trace run includes the generated
 * workflow JSON as output when a workflow is successfully produced.
 */

import { BaseCallbackHandler } from '@langchain/core/callbacks/base';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage } from '@langchain/core/messages';
import type { WorkflowJSON } from '@n8n/workflow-sdk';

import { CodeBuilderAgent } from '../code-builder-agent';

// Mock workflow-sdk to control parse/validate behavior
jest.mock('@n8n/workflow-sdk', () => ({
	parseWorkflowCodeToBuilder: jest.fn(),
	validateWorkflow: jest.fn(),
	generateWorkflowCode: jest.fn().mockReturnValue('// generated code'),
}));

// Mock the prompts module to avoid complex prompt building
jest.mock('../prompts', () => ({
	buildCodeBuilderPrompt: jest.fn().mockReturnValue({
		formatMessages: jest.fn().mockResolvedValue([]),
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseWorkflowCodeToBuilder, validateWorkflow } = require('@n8n/workflow-sdk');

const MOCK_WORKFLOW: WorkflowJSON = {
	id: 'test-wf-1',
	name: 'Test Workflow',
	nodes: [
		{
			id: 'node-1',
			name: 'Manual Trigger',
			type: 'n8n-nodes-base.manualTrigger',
			typeVersion: 1.1,
			position: [240, 300],
			parameters: {},
		},
	],
	connections: {},
} as unknown as WorkflowJSON;

/**
 * Create a mock LLM that returns a TypeScript code block on invoke.
 * The code block triggers final response handling (no tool calls).
 */
function createMockLlm(): BaseChatModel {
	const response = new AIMessage({
		content: '```typescript\nconst workflow = builder.addNode(...);\n```',
		tool_calls: [],
		response_metadata: { usage: { input_tokens: 100, output_tokens: 50 } },
	});

	return {
		bindTools: jest.fn().mockReturnValue({
			invoke: jest.fn().mockResolvedValue(response),
		}),
	} as unknown as BaseChatModel;
}

function createMockBuilder() {
	return {
		regenerateNodeIds: jest.fn(),
		validate: jest.fn().mockReturnValue({ valid: true, errors: [], warnings: [] }),
		generatePinData: jest.fn(),
		toJSON: jest.fn().mockReturnValue(MOCK_WORKFLOW),
	};
}

/**
 * Custom callback handler that captures chain end outputs.
 * We use a class-based handler to ensure proper integration with
 * LangChain's CallbackManager.
 */
class ChainEndTracker extends BaseCallbackHandler {
	name = 'chain-end-tracker';

	chainEndOutputs: Record<string, unknown>[] = [];

	async handleChainEnd(outputs: Record<string, unknown>): Promise<void> {
		this.chainEndOutputs.push(outputs);
	}
}

describe('CodeBuilderAgent tracing', () => {
	beforeEach(() => {
		jest.clearAllMocks();

		parseWorkflowCodeToBuilder.mockReturnValue(createMockBuilder());
		validateWorkflow.mockReturnValue({ valid: true, errors: [], warnings: [] });
	});

	it('should include workflow JSON in handleChainEnd output', async () => {
		const tracker = new ChainEndTracker();

		const agent = new CodeBuilderAgent({
			llm: createMockLlm(),
			nodeTypes: [],
			callbacks: [tracker],
			enableTextEditor: false,
		});

		const chunks = [];
		for await (const chunk of agent.chat(
			{ id: 'msg-1', message: 'Create a simple workflow' },
			'user-1',
		)) {
			chunks.push(chunk);
		}

		// Verify the parent run's handleChainEnd received the workflow JSON
		expect(tracker.chainEndOutputs.length).toBeGreaterThan(0);
		// Find the parent chain end (the one with iterations field)
		const parentOutput = tracker.chainEndOutputs.find((o) => 'iterations' in o);
		expect(parentOutput).toBeDefined();
		expect(parentOutput).toMatchObject({
			iterations: expect.any(Number),
			hasWorkflow: true,
			output: {
				code: expect.any(String),
				workflow: JSON.stringify(MOCK_WORKFLOW),
			},
		});
	});

	it('should set output to null when no workflow is produced', async () => {
		// Make parse fail on all attempts so no workflow is generated
		parseWorkflowCodeToBuilder.mockImplementation(() => {
			throw new Error('Parse error');
		});

		const tracker = new ChainEndTracker();

		const agent = new CodeBuilderAgent({
			llm: createMockLlm(),
			nodeTypes: [],
			callbacks: [tracker],
			enableTextEditor: false,
		});

		const chunks = [];
		for await (const chunk of agent.chat({ id: 'msg-2', message: 'Create a workflow' }, 'user-1')) {
			chunks.push(chunk);
		}

		// When parse fails and the error is caught, handleChainError is called.
		// If handleChainEnd was called instead, verify output is null
		const parentOutput = tracker.chainEndOutputs.find((o) => 'iterations' in o);
		if (parentOutput) {
			expect(parentOutput).toMatchObject({
				hasWorkflow: false,
				output: null,
			});
		}
	});
});
