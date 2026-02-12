import type { INodeUi } from '@/Interface';

export interface NodeCredentialRequirement {
	credentialType: string;
	credentialDisplayName: string;
	selectedCredentialId?: string;
	issues: string[];
	/** Names of all nodes in the setup panel that require this credential type */
	nodesWithSameCredential: string[];
}

export interface NodeSetupState {
	node: INodeUi;
	credentialRequirements: NodeCredentialRequirement[];
	isComplete: boolean;
	isTrigger: boolean;
}

/** One card per unique credential type — groups all nodes that need it */
export interface CredentialTypeSetupState {
	credentialType: string;
	credentialDisplayName: string;
	selectedCredentialId?: string;
	issues: string[];
	/** All node names that require this credential type */
	nodeNames: string[];
	/** Trigger nodes within this credential group (for embedded execute buttons) */
	triggerNodes: INodeUi[];
	isComplete: boolean;
}

/** Trigger card — shows only the test button (no credential picker) */
export interface TriggerSetupState {
	node: INodeUi;
	isComplete: boolean;
}

/** Discriminated union for the setup card list */
export type SetupCardItem =
	| { type: 'trigger'; state: TriggerSetupState }
	| { type: 'credential'; state: CredentialTypeSetupState };
