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
				description: 'Get many blueprint',
				action: 'Get many blueprints',
			},
		],
		default: 'getAll',
		displayOptions: {
			show: {
				resource: ['blueprint'],
			},
		},
	},
	...getAll.description,
];
