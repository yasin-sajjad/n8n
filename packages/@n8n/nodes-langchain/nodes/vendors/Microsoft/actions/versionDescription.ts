/* eslint-disable n8n-nodes-base/node-filename-against-convention */
import { NodeConnectionTypes, type INodeTypeDescription } from 'n8n-workflow';

import * as agentUser from './agentUser';
import * as application from './application';
import * as blueprint from './blueprint';
import * as identity from './identity';

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
			displayName:
				'This is an early preview for building Agents with Microsoft Agent 365 and n8n. You need to be part of the <a href="https://adoption.microsoft.com/copilot/frontier-program/" target="_blank">Frontier preview program</a> to get early access to Microsoft Agent 365. <a href="https://github.com/microsoft/Agent365-Samples/tree/main/nodejs/n8n/sample-agent" target="_blank">Learn more</a>',
			name: 'previewNotice',
			type: 'notice',
			default: '',
		},
		{
			displayName: 'Resource',
			name: 'resource',
			type: 'options',
			noDataExpression: true,
			options: [
				{
					name: 'Agent User',
					value: 'agentUser',
				},
				{
					name: 'Application',
					value: 'application',
				},
				{
					name: 'Blueprint',
					value: 'blueprint',
				},
				{
					name: 'Identity',
					value: 'identity',
				},
			],
			default: 'blueprint',
		},
		...agentUser.description,
		...application.description,
		...blueprint.description,
		...identity.description,
	],
};
