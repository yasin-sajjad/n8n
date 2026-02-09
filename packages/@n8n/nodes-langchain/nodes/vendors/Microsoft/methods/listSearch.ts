import type { ILoadOptionsFunctions, INodeListSearchResult } from 'n8n-workflow';

import { microsoftApiRequest } from '../transport';

export async function blueprintSearch(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const endpoint = '/beta/applications/microsoft.graph.agentIdentityBlueprint';
	const response = await microsoftApiRequest.call(this, 'GET', endpoint, {}, {});

	let blueprints = response.value || [];

	if (filter) {
		blueprints = blueprints.filter(
			(blueprint: { displayName: string; id: string }) =>
				blueprint.displayName?.toLowerCase().includes(filter.toLowerCase()) ||
				blueprint.id?.toLowerCase().includes(filter.toLowerCase()),
		);
	}

	return {
		results: blueprints.map((blueprint: { displayName: string; id: string }) => ({
			name: blueprint.displayName || blueprint.id,
			value: blueprint.id,
		})),
	};
}

export async function identitySearch(
	this: ILoadOptionsFunctions,
	filter?: string,
): Promise<INodeListSearchResult> {
	const endpoint = '/beta/servicePrincipals/microsoft.graph.agentIdentity';
	const response = await microsoftApiRequest.call(this, 'GET', endpoint, {}, {});

	let identities = response.value || [];

	if (filter) {
		identities = identities.filter(
			(identity: { displayName: string; id: string }) =>
				identity.displayName?.toLowerCase().includes(filter.toLowerCase()) ||
				identity.id?.toLowerCase().includes(filter.toLowerCase()),
		);
	}

	return {
		results: identities.map((identity: { displayName: string; id: string }) => ({
			name: identity.displayName || identity.id,
			value: identity.id,
		})),
	};
}
