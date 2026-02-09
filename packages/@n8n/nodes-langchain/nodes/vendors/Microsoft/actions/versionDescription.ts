/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import { NodeConnectionTypes, type INodeTypeDescription } from 'n8n-workflow';

import * as blueprint from './blueprint';

export const versionDescription: INodeTypeDescription = {
	displayName: 'Microsoft Agent 365',
	name: 'microsoftAgent365',
	icon: 'file:Agent365.svg',
	group: ['transform'],
	version: [1],
	defaultVersion: 1,
	subtitle: '={{ $parameter["operation"] + ": " + $parameter["resource"] }}',
	description: 'Manage Microsoft Agent 365',
	defaults: {
		name: 'Microsoft Agent 365',
	},

	codex: {
		alias: ['LangChain', 'Microsoft', 'Agent 365', 'manage'],
		categories: ['AI'],
		subcategories: {
			AI: ['Agents', 'Miscellaneous', 'Root Nodes'],
		},
		resources: {
			primaryDocumentation: [
				{
					url: 'https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-langchain.microsoftagent365/',
				},
			],
		},
	},
	inputs: [NodeConnectionTypes.Main],
	outputs: [NodeConnectionTypes.Main],
	credentials: [
		{
			name: 'microsoftAgent365ManagementApi',
			required: true,
		},
	],
	properties: [
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: [
				{
					name: 'Blueprint',
					value: 'blueprint',
				},
			],
			default: 'blueprint',
		},
		...blueprint.description,
	],
};
