import { createTestNode } from '@/__tests__/mocks';
import type { INodeUi } from '@/Interface';

import {
	getNodeCredentialTypes,
	buildCredentialRequirement,
	isNodeSetupComplete,
	buildNodeSetupState,
	sortNodesByExecutionOrder,
} from './setupPanel.utils';
import type { NodeCredentialRequirement } from './setupPanel.types';

const mockGetNodeTypeDisplayableCredentials = vi.fn().mockReturnValue([]);

vi.mock('@/app/utils/nodes/nodeTransforms', () => ({
	getNodeTypeDisplayableCredentials: (...args: unknown[]) =>
		mockGetNodeTypeDisplayableCredentials(...args),
}));

const createNode = (overrides: Partial<INodeUi> = {}): INodeUi =>
	createTestNode({
		name: 'TestNode',
		type: 'n8n-nodes-base.testNode',
		typeVersion: 1,
		position: [0, 0],
		...overrides,
	}) as INodeUi;

const mockNodeTypeProvider = { getNodeType: vi.fn() };

describe('setupPanel.utils', () => {
	beforeEach(() => {
		mockGetNodeTypeDisplayableCredentials.mockReset().mockReturnValue([]);
	});

	describe('getNodeCredentialTypes', () => {
		it('should return credential types from displayable credentials', () => {
			const node = createNode();
			mockGetNodeTypeDisplayableCredentials.mockReturnValue([
				{ name: 'openAiApi' },
				{ name: 'slackApi' },
			]);

			const result = getNodeCredentialTypes(mockNodeTypeProvider, node);

			expect(result).toEqual(['openAiApi', 'slackApi']);
		});

		it('should include credential types from node issues', () => {
			const node = createNode({
				issues: {
					credentials: {
						httpHeaderAuth: ['Credentials not set'],
					},
				},
			});

			const result = getNodeCredentialTypes(mockNodeTypeProvider, node);

			expect(result).toContain('httpHeaderAuth');
		});

		it('should include credential types from assigned credentials', () => {
			const node = createNode({
				credentials: {
					slackApi: { id: 'cred-1', name: 'My Slack' },
				},
			});

			const result = getNodeCredentialTypes(mockNodeTypeProvider, node);

			expect(result).toContain('slackApi');
		});

		it('should deduplicate credential types from all sources', () => {
			const node = createNode({
				credentials: {
					testApi: { id: 'cred-1', name: 'Test' },
				},
				issues: {
					credentials: {
						testApi: ['Some issue'],
					},
				},
			});
			mockGetNodeTypeDisplayableCredentials.mockReturnValue([{ name: 'testApi' }]);

			const result = getNodeCredentialTypes(mockNodeTypeProvider, node);

			expect(result).toEqual(['testApi']);
		});

		it('should return empty array when node has no credentials', () => {
			const node = createNode();

			const result = getNodeCredentialTypes(mockNodeTypeProvider, node);

			expect(result).toEqual([]);
		});
	});

	describe('buildCredentialRequirement', () => {
		const displayNameLookup = (type: string) => `Display: ${type}`;

		it('should build requirement with selected credential id', () => {
			const node = createNode({
				credentials: {
					testApi: { id: 'cred-1', name: 'My Cred' },
				},
			});
			const nodeNames = new Map([['testApi', ['TestNode']]]);

			const result = buildCredentialRequirement(node, 'testApi', displayNameLookup, nodeNames);

			expect(result).toEqual({
				credentialType: 'testApi',
				credentialDisplayName: 'Display: testApi',
				selectedCredentialId: 'cred-1',
				issues: [],
				nodesWithSameCredential: ['TestNode'],
			});
		});

		it('should return undefined selectedCredentialId when no credential is set', () => {
			const node = createNode();
			const nodeNames = new Map<string, string[]>();

			const result = buildCredentialRequirement(node, 'testApi', displayNameLookup, nodeNames);

			expect(result.selectedCredentialId).toBeUndefined();
		});

		it('should return undefined selectedCredentialId for string credential values', () => {
			const node = createNode({
				credentials: {
					testApi: 'some-string-value',
				} as unknown as INodeUi['credentials'],
			});
			const nodeNames = new Map<string, string[]>();

			const result = buildCredentialRequirement(node, 'testApi', displayNameLookup, nodeNames);

			expect(result.selectedCredentialId).toBeUndefined();
		});

		it('should extract issue messages from credential issues', () => {
			const node = createNode({
				issues: {
					credentials: {
						testApi: ['Issue 1', 'Issue 2'],
					},
				},
			});
			const nodeNames = new Map<string, string[]>();

			const result = buildCredentialRequirement(node, 'testApi', displayNameLookup, nodeNames);

			expect(result.issues).toEqual(['Issue 1', 'Issue 2']);
		});

		it('should normalize single issue string to array', () => {
			const node = createNode({
				issues: {
					credentials: {
						testApi: 'Single issue' as unknown as string[],
					},
				},
			});
			const nodeNames = new Map<string, string[]>();

			const result = buildCredentialRequirement(node, 'testApi', displayNameLookup, nodeNames);

			expect(result.issues).toEqual(['Single issue']);
		});

		it('should return empty nodesWithSameCredential when not in map', () => {
			const node = createNode();
			const nodeNames = new Map<string, string[]>();

			const result = buildCredentialRequirement(node, 'unknownApi', displayNameLookup, nodeNames);

			expect(result.nodesWithSameCredential).toEqual([]);
		});
	});

	describe('isNodeSetupComplete', () => {
		it('should return true when all requirements have id and no issues', () => {
			const requirements: NodeCredentialRequirement[] = [
				{
					credentialType: 'testApi',
					credentialDisplayName: 'Test',
					selectedCredentialId: 'cred-1',
					issues: [],
					nodesWithSameCredential: [],
				},
			];

			expect(isNodeSetupComplete(requirements)).toBe(true);
		});

		it('should return false when a requirement has no selectedCredentialId', () => {
			const requirements: NodeCredentialRequirement[] = [
				{
					credentialType: 'testApi',
					credentialDisplayName: 'Test',
					selectedCredentialId: undefined,
					issues: [],
					nodesWithSameCredential: [],
				},
			];

			expect(isNodeSetupComplete(requirements)).toBe(false);
		});

		it('should return false when a requirement has issues', () => {
			const requirements: NodeCredentialRequirement[] = [
				{
					credentialType: 'testApi',
					credentialDisplayName: 'Test',
					selectedCredentialId: 'cred-1',
					issues: ['Token expired'],
					nodesWithSameCredential: [],
				},
			];

			expect(isNodeSetupComplete(requirements)).toBe(false);
		});

		it('should return true for empty requirements array', () => {
			expect(isNodeSetupComplete([])).toBe(true);
		});

		it('should return false if any one of multiple requirements is incomplete', () => {
			const requirements: NodeCredentialRequirement[] = [
				{
					credentialType: 'apiA',
					credentialDisplayName: 'A',
					selectedCredentialId: 'cred-1',
					issues: [],
					nodesWithSameCredential: [],
				},
				{
					credentialType: 'apiB',
					credentialDisplayName: 'B',
					selectedCredentialId: undefined,
					issues: [],
					nodesWithSameCredential: [],
				},
			];

			expect(isNodeSetupComplete(requirements)).toBe(false);
		});
	});

	describe('buildNodeSetupState', () => {
		const displayNameLookup = (type: string) => `Display: ${type}`;

		it('should build complete state for a fully configured node', () => {
			const node = createNode({
				credentials: {
					testApi: { id: 'cred-1', name: 'Test' },
				},
			});
			const nodeNames = new Map([['testApi', ['TestNode']]]);

			const result = buildNodeSetupState(node, ['testApi'], displayNameLookup, nodeNames);

			expect(result.node).toBe(node);
			expect(result.credentialRequirements).toHaveLength(1);
			expect(result.isComplete).toBe(true);
		});

		it('should build incomplete state for a node missing credentials', () => {
			const node = createNode();
			const nodeNames = new Map<string, string[]>();

			const result = buildNodeSetupState(node, ['testApi'], displayNameLookup, nodeNames);

			expect(result.isComplete).toBe(false);
			expect(result.credentialRequirements[0].selectedCredentialId).toBeUndefined();
		});

		it('should build state with multiple credential requirements', () => {
			const node = createNode({
				credentials: {
					apiA: { id: 'cred-1', name: 'A' },
				},
			});
			const nodeNames = new Map<string, string[]>();

			const result = buildNodeSetupState(node, ['apiA', 'apiB'], displayNameLookup, nodeNames);

			expect(result.credentialRequirements).toHaveLength(2);
			expect(result.isComplete).toBe(false);
		});
	});

	describe('sortNodesByExecutionOrder', () => {
		const makeSetupNode = (name: string, position: [number, number], isTrigger = false) => ({
			node: createNode({ name, position }),
			isTrigger,
			credentialTypes: ['testApi'],
		});

		it('should return empty array for empty input', () => {
			const result = sortNodesByExecutionOrder([], {});

			expect(result).toEqual([]);
		});

		it('should return empty array when there are no triggers', () => {
			const nodeA = makeSetupNode('A', [200, 0]);
			const nodeB = makeSetupNode('B', [100, 0]);

			const result = sortNodesByExecutionOrder([nodeA, nodeB], {});

			expect(result).toEqual([]);
		});

		it('should sort a linear chain by execution order', () => {
			const trigger = makeSetupNode('Trigger', [0, 0], true);
			const nodeA = makeSetupNode('A', [100, 0]);
			const nodeB = makeSetupNode('B', [200, 0]);

			const connections = {
				Trigger: { main: [[{ node: 'A', type: 'main' as const, index: 0 }]] },
				A: { main: [[{ node: 'B', type: 'main' as const, index: 0 }]] },
			};

			const result = sortNodesByExecutionOrder([nodeB, nodeA, trigger], connections);

			expect(result.map((n) => n.node.name)).toEqual(['Trigger', 'A', 'B']);
		});

		it('should drop orphaned nodes not connected to any trigger', () => {
			const trigger = makeSetupNode('Trigger', [0, 0], true);
			const connected = makeSetupNode('Connected', [100, 0]);
			const orphaned = makeSetupNode('Orphaned', [50, 0]);

			const connections = {
				Trigger: { main: [[{ node: 'Connected', type: 'main' as const, index: 0 }]] },
			};

			const result = sortNodesByExecutionOrder([orphaned, connected, trigger], connections);

			expect(result.map((n) => n.node.name)).toEqual(['Trigger', 'Connected']);
		});

		it('should group nodes by trigger, processing triggers by X position', () => {
			const triggerA = makeSetupNode('TriggerA', [200, 0], true);
			const triggerB = makeSetupNode('TriggerB', [0, 0], true);
			const nodeA = makeSetupNode('A', [300, 0]);
			const nodeB = makeSetupNode('B', [100, 0]);

			const connections = {
				TriggerA: { main: [[{ node: 'A', type: 'main' as const, index: 0 }]] },
				TriggerB: { main: [[{ node: 'B', type: 'main' as const, index: 0 }]] },
			};

			const result = sortNodesByExecutionOrder([nodeA, triggerA, nodeB, triggerB], connections);

			// TriggerB (x=0) first with its children, then TriggerA (x=200) with its children
			expect(result.map((n) => n.node.name)).toEqual(['TriggerB', 'B', 'TriggerA', 'A']);
		});

		it('should handle cycles gracefully', () => {
			const trigger = makeSetupNode('Trigger', [0, 0], true);
			const nodeA = makeSetupNode('A', [100, 0]);
			const nodeB = makeSetupNode('B', [200, 0]);

			const connections = {
				Trigger: { main: [[{ node: 'A', type: 'main' as const, index: 0 }]] },
				A: { main: [[{ node: 'B', type: 'main' as const, index: 0 }]] },
				B: { main: [[{ node: 'A', type: 'main' as const, index: 0 }]] },
			};

			const result = sortNodesByExecutionOrder([nodeB, nodeA, trigger], connections);

			expect(result.map((n) => n.node.name)).toEqual(['Trigger', 'A', 'B']);
		});

		it('should traverse through intermediate non-setup nodes', () => {
			const trigger = makeSetupNode('Trigger', [0, 0], true);
			const nodeC = makeSetupNode('C', [300, 0]);

			// Trigger → IntermediateNode → C, but IntermediateNode is not in the setup panel
			const connections = {
				Trigger: { main: [[{ node: 'IntermediateNode', type: 'main' as const, index: 0 }]] },
				IntermediateNode: { main: [[{ node: 'C', type: 'main' as const, index: 0 }]] },
			};

			const result = sortNodesByExecutionOrder([nodeC, trigger], connections);

			expect(result.map((n) => n.node.name)).toEqual(['Trigger', 'C']);
		});

		it('should follow depth-first order, completing each branch before the next', () => {
			const trigger = makeSetupNode('Trigger', [0, 0], true);
			const nodeA = makeSetupNode('A', [100, 0]);
			const nodeB = makeSetupNode('B', [200, 0]);
			const nodeC = makeSetupNode('C', [100, 100]);
			const nodeD = makeSetupNode('D', [200, 100]);

			// Trigger → A → B
			//         ↘ C → D
			const connections = {
				Trigger: {
					main: [
						[
							{ node: 'A', type: 'main' as const, index: 0 },
							{ node: 'C', type: 'main' as const, index: 0 },
						],
					],
				},
				A: { main: [[{ node: 'B', type: 'main' as const, index: 0 }]] },
				C: { main: [[{ node: 'D', type: 'main' as const, index: 0 }]] },
			};

			const result = sortNodesByExecutionOrder([nodeD, nodeC, nodeB, nodeA, trigger], connections);

			// DFS: completes A→B before visiting C→D
			// (BFS would produce: Trigger, A, C, B, D)
			expect(result.map((n) => n.node.name)).toEqual(['Trigger', 'A', 'B', 'C', 'D']);
		});

		it('should not duplicate nodes reachable from multiple triggers', () => {
			const triggerA = makeSetupNode('TriggerA', [0, 0], true);
			const triggerB = makeSetupNode('TriggerB', [100, 100], true);
			const shared = makeSetupNode('Shared', [200, 50]);

			const connections = {
				TriggerA: { main: [[{ node: 'Shared', type: 'main' as const, index: 0 }]] },
				TriggerB: { main: [[{ node: 'Shared', type: 'main' as const, index: 0 }]] },
			};

			const result = sortNodesByExecutionOrder([shared, triggerB, triggerA], connections);

			// Shared appears only once, under the first trigger (TriggerA, x=0)
			expect(result.map((n) => n.node.name)).toEqual(['TriggerA', 'Shared', 'TriggerB']);
		});
	});
});
