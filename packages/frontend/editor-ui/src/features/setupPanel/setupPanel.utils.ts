import type { IConnections } from 'n8n-workflow';

import type { INodeUi } from '@/Interface';
import type { NodeTypeProvider } from '@/app/utils/nodeTypes/nodeTypeTransforms';
import { getNodeTypeDisplayableCredentials } from '@/app/utils/nodes/nodeTransforms';

import type { NodeCredentialRequirement, NodeSetupState } from './setupPanel.types';

/**
 * Collects all credential types that a node requires from three sources:
 * 1. Node type definition — standard credentials with displayOptions
 * 2. Node issues — dynamic credentials (e.g. in HTTP Request node) that are missing or invalid
 * 3. Assigned credentials — dynamic credentials already properly set
 */
export function getNodeCredentialTypes(
	nodeTypeProvider: NodeTypeProvider,
	node: INodeUi,
): string[] {
	const credentialTypes = new Set<string>();

	const displayableCredentials = getNodeTypeDisplayableCredentials(nodeTypeProvider, node);
	for (const cred of displayableCredentials) {
		credentialTypes.add(cred.name);
	}

	const credentialIssues = node.issues?.credentials ?? {};
	for (const credType of Object.keys(credentialIssues)) {
		credentialTypes.add(credType);
	}

	if (node.credentials) {
		for (const credType of Object.keys(node.credentials)) {
			credentialTypes.add(credType);
		}
	}

	return Array.from(credentialTypes);
}

/**
 * Builds a single credential requirement entry for a node + credential type pair.
 */
export function buildCredentialRequirement(
	node: INodeUi,
	credentialType: string,
	getCredentialDisplayName: (type: string) => string,
	credentialTypeToNodeNames: Map<string, string[]>,
): NodeCredentialRequirement {
	const credValue = node.credentials?.[credentialType];
	const selectedCredentialId =
		typeof credValue === 'string' ? undefined : (credValue?.id ?? undefined);

	const credentialIssues = node.issues?.credentials ?? {};
	const issues = credentialIssues[credentialType];
	const issueMessages = [issues ?? []].flat();

	return {
		credentialType,
		credentialDisplayName: getCredentialDisplayName(credentialType),
		selectedCredentialId,
		issues: issueMessages,
		nodesWithSameCredential: credentialTypeToNodeNames.get(credentialType) ?? [],
	};
}

/**
 * Checks whether all credential requirements for a node are satisfied
 * (each has a selected credential with no issues).
 */
export function isNodeSetupComplete(requirements: NodeCredentialRequirement[]): boolean {
	return requirements.every((req) => req.selectedCredentialId && req.issues.length === 0);
}

/**
 * Builds the full setup state for a single node: its credential requirements
 * and whether the node is fully configured.
 */
export function buildNodeSetupState(
	node: INodeUi,
	credentialTypes: string[],
	getCredentialDisplayName: (type: string) => string,
	credentialTypeToNodeNames: Map<string, string[]>,
	isTrigger = false,
	hasTriggerExecuted = false,
): NodeSetupState {
	const credentialRequirements = credentialTypes.map((credType) =>
		buildCredentialRequirement(node, credType, getCredentialDisplayName, credentialTypeToNodeNames),
	);

	const credentialsConfigured = isNodeSetupComplete(credentialRequirements);

	// For triggers: complete only after successful execution
	// For regular nodes: complete when credentials are configured
	const isComplete = isTrigger
		? credentialsConfigured && hasTriggerExecuted
		: credentialsConfigured;

	return {
		node,
		credentialRequirements,
		isComplete,
		isTrigger,
	};
}

interface SetupNode {
	node: INodeUi;
	isTrigger: boolean;
	credentialTypes: string[];
}

/**
 * Orders setup panel nodes by execution order, grouped by trigger.
 * Iterates triggers (sorted by X position), DFS-ing each trigger's subgraph
 * to collect downstream nodes in execution order (depth-first, matching the
 * backend v1 execution strategy). This lets users complete one full branch
 * before moving to the next. Nodes reachable from multiple triggers appear
 * only under the first trigger visited.
 * Orphaned nodes (not reachable from any trigger) are dropped.
 * When there are no triggers, returns an empty array.
 */
export function sortNodesByExecutionOrder(
	nodes: SetupNode[],
	connectionsBySourceNode: IConnections,
): SetupNode[] {
	const triggers = nodes
		.filter((item) => item.isTrigger)
		.sort((a, b) => a.node.position[0] - b.node.position[0]);

	if (triggers.length === 0) return [];

	const setupNodesByName = new Map<string, SetupNode>();
	for (const item of nodes) {
		setupNodesByName.set(item.node.name, item);
	}

	const result: SetupNode[] = [];
	const visited = new Set<string>();

	for (const trigger of triggers) {
		if (visited.has(trigger.node.name)) continue;
		visited.add(trigger.node.name);
		result.push(trigger);

		// DFS through all workflow connections from this trigger
		const dfs = (name: string) => {
			const nodeConns = connectionsBySourceNode[name];
			if (!nodeConns) return;
			for (const type of Object.keys(nodeConns)) {
				for (const outputs of nodeConns[type]) {
					for (const conn of outputs ?? []) {
						if (visited.has(conn.node)) continue;
						visited.add(conn.node);
						const setupNode = setupNodesByName.get(conn.node);
						if (setupNode) {
							result.push(setupNode);
						}
						dfs(conn.node);
					}
				}
			}
		};
		dfs(trigger.node.name);
	}

	return result;
}
