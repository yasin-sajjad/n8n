import { createTestNode } from '@/__tests__/mocks';
import type { INodeUi } from '@/Interface';

import {
	getNodeCredentialTypes,
	buildCredentialRequirement,
	isNodeSetupComplete,
	buildNodeSetupState,
	groupCredentialsByType,
	buildTriggerSetupState,
	sortCredentialTypeStates,
} from './setupPanel.utils';
import type { CredentialTypeSetupState, NodeCredentialRequirement } from './setupPanel.types';

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

	describe('groupCredentialsByType', () => {
		const displayNameLookup = (type: string) => `Display: ${type}`;

		it('should group multiple nodes sharing the same credential type', () => {
			const nodeA = createNode({
				name: 'NodeA',
				credentials: { slackApi: { id: 'cred-1', name: 'Slack' } },
			});
			const nodeB = createNode({
				name: 'NodeB',
				credentials: { slackApi: { id: 'cred-2', name: 'Slack 2' } },
			});

			const result = groupCredentialsByType(
				[
					{ node: nodeA, credentialTypes: ['slackApi'] },
					{ node: nodeB, credentialTypes: ['slackApi'] },
				],
				displayNameLookup,
			);

			expect(result).toHaveLength(1);
			expect(result[0].credentialType).toBe('slackApi');
			expect(result[0].credentialDisplayName).toBe('Display: slackApi');
			expect(result[0].nodeNames).toEqual(['NodeA', 'NodeB']);
		});

		it('should pick selectedCredentialId from the first node that has it', () => {
			const nodeA = createNode({ name: 'NodeA' });
			const nodeB = createNode({
				name: 'NodeB',
				credentials: { slackApi: { id: 'cred-2', name: 'Slack' } },
			});

			const result = groupCredentialsByType(
				[
					{ node: nodeA, credentialTypes: ['slackApi'] },
					{ node: nodeB, credentialTypes: ['slackApi'] },
				],
				displayNameLookup,
			);

			expect(result[0].selectedCredentialId).toBe('cred-2');
		});

		it('should merge issues from multiple nodes without duplicates', () => {
			const nodeA = createNode({
				name: 'NodeA',
				issues: { credentials: { slackApi: ['Token expired'] } },
			});
			const nodeB = createNode({
				name: 'NodeB',
				issues: { credentials: { slackApi: ['Token expired', 'Rate limited'] } },
			});

			const result = groupCredentialsByType(
				[
					{ node: nodeA, credentialTypes: ['slackApi'] },
					{ node: nodeB, credentialTypes: ['slackApi'] },
				],
				displayNameLookup,
			);

			expect(result[0].issues).toEqual(['Token expired', 'Rate limited']);
		});

		it('should collect all nodeNames in the group', () => {
			const nodes = ['A', 'B', 'C'].map((name) =>
				createNode({ name, credentials: { api: { id: `cred-${name}`, name } } }),
			);

			const result = groupCredentialsByType(
				nodes.map((node) => ({ node, credentialTypes: ['api'] })),
				displayNameLookup,
			);

			expect(result[0].nodeNames).toEqual(['A', 'B', 'C']);
		});

		it('should set isComplete to true when selectedCredentialId exists and no issues', () => {
			const node = createNode({
				name: 'NodeA',
				credentials: { slackApi: { id: 'cred-1', name: 'Slack' } },
			});

			const result = groupCredentialsByType(
				[{ node, credentialTypes: ['slackApi'] }],
				displayNameLookup,
			);

			expect(result[0].isComplete).toBe(true);
		});

		it('should set isComplete to false when selectedCredentialId is missing', () => {
			const node = createNode({ name: 'NodeA' });

			const result = groupCredentialsByType(
				[{ node, credentialTypes: ['slackApi'] }],
				displayNameLookup,
			);

			expect(result[0].isComplete).toBe(false);
		});

		it('should set isComplete to false when there are issues', () => {
			const node = createNode({
				name: 'NodeA',
				credentials: { slackApi: { id: 'cred-1', name: 'Slack' } },
				issues: { credentials: { slackApi: ['Token expired'] } },
			});

			const result = groupCredentialsByType(
				[{ node, credentialTypes: ['slackApi'] }],
				displayNameLookup,
			);

			expect(result[0].isComplete).toBe(false);
		});

		it('should return empty array for empty input', () => {
			const result = groupCredentialsByType([], displayNameLookup);

			expect(result).toEqual([]);
		});

		it('should create separate entries for different credential types', () => {
			const node = createNode({
				name: 'NodeA',
				credentials: {
					slackApi: { id: 'cred-1', name: 'Slack' },
					githubApi: { id: 'cred-2', name: 'GitHub' },
				},
			});

			const result = groupCredentialsByType(
				[{ node, credentialTypes: ['slackApi', 'githubApi'] }],
				displayNameLookup,
			);

			expect(result).toHaveLength(2);
			expect(result.map((s) => s.credentialType)).toEqual(['slackApi', 'githubApi']);
		});
	});

	describe('buildTriggerSetupState', () => {
		it('should be complete when trigger has no credential types and has executed', () => {
			const node = createNode({ name: 'Trigger' });

			const result = buildTriggerSetupState(node, [], [], true);

			expect(result.node).toBe(node);
			expect(result.isComplete).toBe(true);
		});

		it('should be incomplete when trigger has no credential types and has not executed', () => {
			const node = createNode({ name: 'Trigger' });

			const result = buildTriggerSetupState(node, [], [], false);

			expect(result.isComplete).toBe(false);
		});

		it('should be incomplete when credentials are complete but trigger has not executed', () => {
			const node = createNode({ name: 'Trigger' });
			const credentialTypeStates: CredentialTypeSetupState[] = [
				{
					credentialType: 'slackApi',
					credentialDisplayName: 'Slack',
					selectedCredentialId: 'cred-1',
					issues: [],
					nodeNames: ['Trigger'],
					isComplete: true,
				},
			];

			const result = buildTriggerSetupState(node, ['slackApi'], credentialTypeStates, false);

			expect(result.isComplete).toBe(false);
		});

		it('should be incomplete when trigger has executed but credentials are incomplete', () => {
			const node = createNode({ name: 'Trigger' });
			const credentialTypeStates: CredentialTypeSetupState[] = [
				{
					credentialType: 'slackApi',
					credentialDisplayName: 'Slack',
					selectedCredentialId: undefined,
					issues: [],
					nodeNames: ['Trigger'],
					isComplete: false,
				},
			];

			const result = buildTriggerSetupState(node, ['slackApi'], credentialTypeStates, true);

			expect(result.isComplete).toBe(false);
		});

		it('should be complete when all credentials are complete and trigger has executed', () => {
			const node = createNode({ name: 'Trigger' });
			const credentialTypeStates: CredentialTypeSetupState[] = [
				{
					credentialType: 'slackApi',
					credentialDisplayName: 'Slack',
					selectedCredentialId: 'cred-1',
					issues: [],
					nodeNames: ['Trigger'],
					isComplete: true,
				},
				{
					credentialType: 'githubApi',
					credentialDisplayName: 'GitHub',
					selectedCredentialId: 'cred-2',
					issues: [],
					nodeNames: ['Trigger'],
					isComplete: true,
				},
			];

			const result = buildTriggerSetupState(
				node,
				['slackApi', 'githubApi'],
				credentialTypeStates,
				true,
			);

			expect(result.isComplete).toBe(true);
		});

		it('should treat missing credential type states as complete', () => {
			const node = createNode({ name: 'Trigger' });

			const result = buildTriggerSetupState(node, ['unknownApi'], [], true);

			expect(result.isComplete).toBe(true);
		});
	});

	describe('sortCredentialTypeStates', () => {
		it('should sort by the leftmost node X position in each group', () => {
			const nodeA = createNode({ name: 'NodeA', position: [300, 0] });
			const nodeB = createNode({ name: 'NodeB', position: [100, 0] });
			const nodeC = createNode({ name: 'NodeC', position: [200, 0] });

			const nodeMap = new Map<string, INodeUi>([
				['NodeA', nodeA],
				['NodeB', nodeB],
				['NodeC', nodeC],
			]);
			const getNodeByName = (name: string) => nodeMap.get(name);

			const states: CredentialTypeSetupState[] = [
				{
					credentialType: 'apiA',
					credentialDisplayName: 'A',
					issues: [],
					nodeNames: ['NodeA'],
					isComplete: true,
				},
				{
					credentialType: 'apiB',
					credentialDisplayName: 'B',
					issues: [],
					nodeNames: ['NodeB'],
					isComplete: true,
				},
				{
					credentialType: 'apiC',
					credentialDisplayName: 'C',
					issues: [],
					nodeNames: ['NodeC'],
					isComplete: true,
				},
			];

			const result = sortCredentialTypeStates(states, getNodeByName);

			expect(result.map((s) => s.credentialType)).toEqual(['apiB', 'apiC', 'apiA']);
		});

		it('should use the minimum X position when a group has multiple nodes', () => {
			const nodeA = createNode({ name: 'NodeA', position: [500, 0] });
			const nodeB = createNode({ name: 'NodeB', position: [50, 0] });
			const nodeC = createNode({ name: 'NodeC', position: [200, 0] });

			const nodeMap = new Map<string, INodeUi>([
				['NodeA', nodeA],
				['NodeB', nodeB],
				['NodeC', nodeC],
			]);
			const getNodeByName = (name: string) => nodeMap.get(name);

			const states: CredentialTypeSetupState[] = [
				{
					credentialType: 'apiX',
					credentialDisplayName: 'X',
					issues: [],
					nodeNames: ['NodeA', 'NodeB'],
					isComplete: true,
				},
				{
					credentialType: 'apiY',
					credentialDisplayName: 'Y',
					issues: [],
					nodeNames: ['NodeC'],
					isComplete: true,
				},
			];

			const result = sortCredentialTypeStates(states, getNodeByName);

			// apiX min is 50 (NodeB), apiY min is 200 (NodeC) -> apiX first
			expect(result.map((s) => s.credentialType)).toEqual(['apiX', 'apiY']);
		});

		it('should handle unknown node names by treating their position as Infinity', () => {
			const nodeA = createNode({ name: 'NodeA', position: [100, 0] });

			const nodeMap = new Map<string, INodeUi>([['NodeA', nodeA]]);
			const getNodeByName = (name: string) => nodeMap.get(name);

			const states: CredentialTypeSetupState[] = [
				{
					credentialType: 'apiUnknown',
					credentialDisplayName: 'Unknown',
					issues: [],
					nodeNames: ['MissingNode'],
					isComplete: true,
				},
				{
					credentialType: 'apiKnown',
					credentialDisplayName: 'Known',
					issues: [],
					nodeNames: ['NodeA'],
					isComplete: true,
				},
			];

			const result = sortCredentialTypeStates(states, getNodeByName);

			expect(result.map((s) => s.credentialType)).toEqual(['apiKnown', 'apiUnknown']);
		});

		it('should not mutate the original array', () => {
			const states: CredentialTypeSetupState[] = [
				{
					credentialType: 'apiB',
					credentialDisplayName: 'B',
					issues: [],
					nodeNames: ['NodeB'],
					isComplete: true,
				},
				{
					credentialType: 'apiA',
					credentialDisplayName: 'A',
					issues: [],
					nodeNames: ['NodeA'],
					isComplete: true,
				},
			];

			const nodeA = createNode({ name: 'NodeA', position: [100, 0] });
			const nodeB = createNode({ name: 'NodeB', position: [200, 0] });
			const nodeMap = new Map<string, INodeUi>([
				['NodeA', nodeA],
				['NodeB', nodeB],
			]);
			const getNodeByName = (name: string) => nodeMap.get(name);

			const result = sortCredentialTypeStates(states, getNodeByName);

			expect(result).not.toBe(states);
			expect(states[0].credentialType).toBe('apiB');
		});
	});
});
