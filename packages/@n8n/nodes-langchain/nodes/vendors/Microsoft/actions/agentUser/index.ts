import type { INodeProperties } from 'n8n-workflow';

import * as getAll from './getAll.operation';

export { getAll };

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
				description: 'Get many agent users',
				action: 'Get many agent users',
			},
		],
		default: 'getAll',
		displayOptions: {
			show: {
				resource: ['agentUser'],
			},
		},
	},
	...getAll.description,
];
