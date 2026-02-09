import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class MicrosoftAgent365ManagementApi implements ICredentialType {
	name = 'microsoftAgent365ManagementApi';

	extends = ['microsoftOAuth2Api'];

	displayName = 'Microsoft 365 Agent Management API';

	documentationUrl = 'microsoft';

	properties: INodeProperties[] = [
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default:
				'openid offline_access Application.ReadWrite.All AgentIdentity.ReadWrite.All AgentIdentityBlueprint.ReadWrite.All AgentIdentityBlueprintPrincipal.ReadWrite.All User.ReadWrite.All',
		},
	];
}
