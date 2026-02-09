import type { INodeProperties } from 'n8n-workflow';

import * as getAll from './getAll.operation';
import * as update from './update.operation';

export { getAll, update };

export const description: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Get many agent identities',
				action: 'Get many agent identities',
			},
			{
				name: 'Update',
				value: 'update',
				description: 'Update an agent identity',
				action: 'Update an agent identity',
			},
		],
		default: 'getAll',
		displayOptions: {
			show: {
				resource: ['identity'],
			},
		},
	},
	...getAll.description,
	...update.description,
];
