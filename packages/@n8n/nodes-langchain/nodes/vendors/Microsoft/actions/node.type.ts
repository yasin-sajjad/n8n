import type { AllEntities } from 'n8n-workflow';

type NodeMap = {
	agentUser: 'getAll';
	application: 'getAll';
	blueprint: 'getAll' | 'update';
	identity: 'getAll' | 'update';
};

export type MicrosoftAgent365Type = AllEntities<NodeMap>;
