import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';
import { microsoftApiRequest } from '../../transport';
import { identityRLC } from '../descriptions';

const properties: INodeProperties[] = [
	identityRLC,
	{
		displayName: 'Update Fields',
		name: 'updateFields',
		type: 'collection',
		placeholder: 'Add Field',
		default: {},
		options: [
			{
				displayName: 'Display Name',
				name: 'displayName',
				type: 'string',
				default: '',
				description: 'The display name for the agent identity',
			},
			{
				displayName: 'Account Enabled',
				name: 'accountEnabled',
				type: 'boolean',
				default: true,
				description: 'Whether the agent identity account is enabled',
			},
			{
				displayName: 'Tags',
				name: 'tags',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Add Tag',
				options: [
					{
						name: 'tag',
						displayName: 'Tag',
						values: [
							{
								displayName: 'Tag',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Custom tag for categorizing the agent identity',
							},
						],
					},
				],
				description: 'Custom tags for the agent identity',
			},
		],
	},
];

const displayOptions = {
	show: {
		operation: ['update'],
		resource: ['identity'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const identityId = this.getNodeParameter('identityId', index, '', {
		extractValue: true,
	}) as string;
	const updateFields = this.getNodeParameter('updateFields', index) as IDataObject;

	const endpoint = `/beta/servicePrincipals/${identityId}/microsoft.graph.agentIdentity`;

	const body: IDataObject = {};

	if (updateFields.displayName !== undefined) {
		body.displayName = updateFields.displayName;
	}
	if (updateFields.accountEnabled !== undefined) {
		body.accountEnabled = updateFields.accountEnabled;
	}
	if (updateFields.tags) {
		const tags = (updateFields.tags as IDataObject).tag as IDataObject[];
		if (tags && tags.length > 0) {
			body.tags = tags.map((t) => t.value);
		}
	}

	await microsoftApiRequest.call(this, 'PATCH', endpoint, body);

	return this.helpers.returnJsonArray({ success: true });
}
