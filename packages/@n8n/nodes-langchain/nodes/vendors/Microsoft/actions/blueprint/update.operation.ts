import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
} from 'n8n-workflow';
import { updateDisplayOptions } from 'n8n-workflow';
import { microsoftApiRequest } from '../../transport';
import { blueprintRLC } from '../descriptions';

const properties: INodeProperties[] = [
	blueprintRLC,
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
				description: 'The display name for the application',
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'Free text field to provide a description of the application to end users',
			},
			{
				displayName: 'Sign In Audience',
				name: 'signInAudience',
				type: 'options',
				options: [
					{
						name: 'Azure AD My Org Only',
						value: 'AzureADMyOrg',
						description:
							"Users with a Microsoft work or school account in my organization's Azure AD tenant (single-tenant)",
					},
					{
						name: 'Azure AD Multiple Orgs',
						value: 'AzureADMultipleOrgs',
						description:
							"Users with a Microsoft work or school account in any organization's Azure AD tenant (multi-tenant)",
					},
					{
						name: 'Azure AD and Personal Microsoft Accounts',
						value: 'AzureADandPersonalMicrosoftAccount',
						description:
							'Users with a Microsoft work or school account, or a personal Microsoft account',
					},
					{
						name: 'Personal Microsoft Accounts Only',
						value: 'PersonalMicrosoftAccount',
						description: 'Users with a personal Microsoft account only',
					},
				],
				default: 'AzureADMyOrg',
				description:
					'Specifies the Microsoft accounts that are supported for the current application',
			},
			{
				displayName: 'Identifier URIs',
				name: 'identifierUris',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: {},
				placeholder: 'Add URI',
				options: [
					{
						name: 'uri',
						displayName: 'URI',
						values: [
							{
								displayName: 'URI',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'e.g., api://my-app-ID',
								description: 'Application ID URI',
							},
						],
					},
				],
				description: 'The URIs that identify the application within its Azure AD tenant',
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
								description:
									'Custom strings that can be used to categorize and identify the application',
							},
						],
					},
				],
				description: 'Custom strings that can be used to categorize and identify the application',
			},
			{
				displayName: 'Group Membership Claims',
				name: 'groupMembershipClaims',
				type: 'options',
				options: [
					{
						name: 'All',
						value: 'All',
					},
					{
						name: 'Application Group',
						value: 'ApplicationGroup',
					},
					{
						name: 'Directory Role',
						value: 'DirectoryRole',
					},
					{
						name: 'None',
						value: 'None',
					},
					{
						name: 'Security Group',
						value: 'SecurityGroup',
					},
				],
				default: 'None',
				description: 'Configures the groups claim issued in a user or OAuth 2.0 access token',
			},
			{
				displayName: 'Default Redirect URI',
				name: 'defaultRedirectUri',
				type: 'string',
				default: '',
				description: 'Specifies the default redirect URI',
			},
			{
				displayName: 'Service Management Reference',
				name: 'serviceManagementReference',
				type: 'string',
				default: '',
				description:
					'References application or service contact information from a Service or Asset Management database',
			},
			{
				displayName: 'Token Encryption Key ID',
				name: 'tokenEncryptionKeyId',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				description: 'Specifies the keyId of a public key from the keyCredentials collection',
			},
		],
	},
];

const displayOptions = {
	show: {
		operation: ['update'],
		resource: ['blueprint'],
	},
};

export const description = updateDisplayOptions(displayOptions, properties);

export async function execute(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const blueprintId = this.getNodeParameter('blueprintId', index, '', {
		extractValue: true,
	}) as string;
	const updateFields = this.getNodeParameter('updateFields', index) as IDataObject;

	const endpoint = `/beta/applications/${blueprintId}/microsoft.graph.agentIdentityBlueprint`;

	const body: IDataObject = {};

	if (updateFields.displayName !== undefined) {
		body.displayName = updateFields.displayName;
	}
	if (updateFields.description !== undefined) {
		body.description = updateFields.description;
	}
	if (updateFields.signInAudience !== undefined) {
		body.signInAudience = updateFields.signInAudience;
	}
	if (updateFields.groupMembershipClaims !== undefined) {
		body.groupMembershipClaims = updateFields.groupMembershipClaims;
	}
	if (updateFields.defaultRedirectUri !== undefined) {
		body.defaultRedirectUri = updateFields.defaultRedirectUri;
	}
	if (updateFields.serviceManagementReference !== undefined) {
		body.serviceManagementReference = updateFields.serviceManagementReference;
	}
	if (updateFields.tokenEncryptionKeyId !== undefined) {
		body.tokenEncryptionKeyId = updateFields.tokenEncryptionKeyId;
	}
	if (updateFields.identifierUris) {
		const uris = (updateFields.identifierUris as IDataObject).uri as IDataObject[];
		if (uris && uris.length > 0) {
			body.identifierUris = uris.map((u) => u.value);
		}
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
