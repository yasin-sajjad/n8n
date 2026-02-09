import type { INodeProperties } from 'n8n-workflow';

export const blueprintRLC: INodeProperties = {
	displayName: 'Blueprint',
	name: 'blueprintId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The blueprint to update',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'blueprintSearch',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g., bd363e81-443c-4b79-817d-b59d7e12e5a0',
		},
	],
};

export const identityRLC: INodeProperties = {
	displayName: 'Identity',
	name: 'identityId',
	type: 'resourceLocator',
	default: { mode: 'list', value: '' },
	required: true,
	description: 'The agent identity to update',
	modes: [
		{
			displayName: 'From List',
			name: 'list',
			type: 'list',
			typeOptions: {
				searchListMethod: 'identitySearch',
				searchable: true,
			},
		},
		{
			displayName: 'By ID',
			name: 'id',
			type: 'string',
			placeholder: 'e.g., 2ea3bd7e-6e29-480f-b1e0-b1475fd3c993',
		},
	],
};
