import type { User } from '@n8n/db';
import { hasGlobalScope } from '@n8n/permissions';
import get from 'lodash/get';
import { type ICredentialDataDecryptedObject } from 'n8n-workflow';

import { BadRequestError } from '@/errors/response-errors/bad-request.error';
import type { SecretsProviderAccessCheckService } from '@/modules/external-secrets.ee/secret-provider-access-check.service.ee';
import { getAllKeyPaths } from '@/utils';

// #region External Secrets

/**
 * Checks if a string value contains an external secret expression.
 * Detects both dot notation ($secrets.vault.key) and bracket notation ($secrets['vault']['key']).
 */
export function containsExternalSecretExpression(value: string): boolean {
	return value.includes('$secrets.') || value.includes('$secrets[');
}

/**
 * Extracts the provider key from an external secret expression.
 * Supports both dot notation ($secrets.vault.key) and bracket notation ($secrets['vault']['key']).
 *
 * @param expression - The expression string containing $secrets reference
 * @returns The provider key, or null if extraction fails
 *
 * @example
 * extractProviderKey("={{ $secrets.vault.myKey }}") // returns "vault"
 * extractProviderKey("={{ $secrets['aws']['secret'] }}") // returns "aws"
 */
export function extractProviderKey(expression: string): string | null {
	// Handle dot notation: $secrets.providerKey.secretName
	const dotMatch = expression.match(/\$secrets\.([a-zA-Z0-9_-]+)/);
	if (dotMatch) {
		return dotMatch[1];
	}

	// Handle bracket notation: $secrets['providerKey'] or $secrets["providerKey"]
	const bracketMatch = expression.match(/\$secrets\[['"]([a-zA-Z0-9_-]+)['"]\]/);
	if (bracketMatch) {
		return bracketMatch[1];
	}

	return null;
}

/**
 * Checks if credential data contains any external secret expressions ($secrets)
 */
function containsExternalSecrets(data: ICredentialDataDecryptedObject): boolean {
	const secretPaths = getAllKeyPaths(data, '', [], containsExternalSecretExpression);
	return secretPaths.length > 0;
}

/**
 * Checks if any changed field in a credential contains an external secret expression
 */
export function isChangingExternalSecretExpression(
	newData: ICredentialDataDecryptedObject,
	existingData: ICredentialDataDecryptedObject,
): boolean {
	// Find all paths in newData that contain external secret expressions
	const newSecretPaths = getAllKeyPaths(newData, '', [], containsExternalSecretExpression);

	// Check if any of these paths represent a change from existingData
	for (const path of newSecretPaths) {
		const newValue = get(newData, path);
		const existingValue = get(existingData, path);

		if (newValue !== existingValue) {
			return true; // External secret expression is being added or modified
		}
	}

	return false;
}

/**
 * Validates if a user has permission to use external secrets in credentials
 *
 * @param dataToSave - only optional in case it's not provided in the payload of the request
 * @param decryptedExistingData - Optional existing credential data (optional as it can only be provided when updating an existing credential)
 * @throws {BadRequestError} If user lacks permission when attempting to use external secrets
 */
export function validateExternalSecretsPermissions(
	user: User,
	dataToSave?: ICredentialDataDecryptedObject,
	decryptedExistingData?: ICredentialDataDecryptedObject,
): void {
	if (!dataToSave) {
		return;
	}
	const isUpdatingExistingCredential = !!decryptedExistingData;
	const needsCheck = isUpdatingExistingCredential
		? isChangingExternalSecretExpression(dataToSave, decryptedExistingData)
		: containsExternalSecrets(dataToSave);
	if (needsCheck) {
		if (!hasGlobalScope(user, 'externalSecret:list')) {
			throw new BadRequestError('Lacking permissions to reference external secrets in credentials');
		}
	}
}

/**
 * Validates that the project has access to all external secret providers referenced in credential data.
 *
 * Call validateExternalSecretsPermissions before this one.
 *
 * @param projectId - The project ID to check access for
 * @param data - The credential data that may contain external secret expressions
 * @param externalSecretsProviderAccessCheckService - Service to check provider access
 * @throws BadRequestError if any providers are inaccessible.
 */
export async function validateAccessToReferencedSecretProviders(
	projectId: string,
	data: ICredentialDataDecryptedObject,
	externalSecretsProviderAccessCheckService: SecretsProviderAccessCheckService,
) {
	const secretPaths = getAllKeyPaths(data, '', [], containsExternalSecretExpression);
	if (secretPaths.length === 0) {
		return; // No external secrets referenced, nothing to check
	}

	// Track which credential properties use which providers
	const providerToCredentialPropertyMap = new Map<string, string[]>();

	for (const credentialProperty of secretPaths) {
		const expressionString = get(data, credentialProperty);
		if (typeof expressionString === 'string') {
			const providerKey = extractProviderKey(expressionString);
			if (providerKey === null) {
				throw new BadRequestError(
					`Could not find a valid external secret vault name inside "${expressionString}" used in "${credentialProperty}"`,
				);
			}

			const credentialProperties = providerToCredentialPropertyMap.get(providerKey) ?? [];
			credentialProperties.push(credentialProperty);
			providerToCredentialPropertyMap.set(providerKey, credentialProperties);
		}
	}

	// Early return if no valid providers found
	if (providerToCredentialPropertyMap.size === 0) {
		return;
	}

	// map of inaccessible providerKey -> list of credential properties that reference it
	const inaccessibleProviders = new Map<string, string[]>();
	const providerKeys = Array.from(providerToCredentialPropertyMap.keys());

	await Promise.all(
		providerKeys.map(async (providerKey) => {
			const hasAccess =
				await externalSecretsProviderAccessCheckService.isProviderAvailableInProject(
					providerKey,
					projectId,
				);

			if (!hasAccess) {
				const credentialProperties = providerToCredentialPropertyMap.get(providerKey) ?? [];
				if (credentialProperties.length > 0) {
					inaccessibleProviders.set(providerKey, credentialProperties);
				}
			}
		}),
	);

	// Throw error if any providers are inaccessible
	if (inaccessibleProviders.size > 0) {
		const formatCredentialPropertyList = (properties: string[]): string => {
			return properties.map((f) => `"${f}"`).join(', ');
		};
		if (inaccessibleProviders.size === 1) {
			const [providerKey, credentialProperties] = Array.from(inaccessibleProviders.entries())[0];
			const credentialPropertyList = formatCredentialPropertyList(credentialProperties);
			throw new BadRequestError(
				`The secret provider "${providerKey}" used in ${credentialPropertyList} does not exist in this project`,
			);
		} else {
			const providerDetails = Array.from(inaccessibleProviders.entries())
				.map(([provider, fields]) => {
					const credentialPopertyList = formatCredentialPropertyList(fields);
					return `"${provider}" (used in ${credentialPopertyList})`;
				})
				.join(', ');
			throw new BadRequestError(
				`The secret providers ${providerDetails} do not exist in this project`,
			);
		}
	}
}

// #endregion
