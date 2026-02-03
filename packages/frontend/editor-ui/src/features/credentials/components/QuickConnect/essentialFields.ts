/**
 * Essential fields configuration for the Quick Connect modal.
 *
 * This module defines which fields are considered "essential" for common credential types,
 * allowing the Quick Connect modal to show a simplified view with only the most important fields.
 */

/**
 * Mapping of credential type names to their essential field names.
 * These are the minimum required fields that users typically need to fill in.
 */
export const ESSENTIAL_FIELDS: Record<string, string[]> = {
	openAiApi: ['apiKey'],
	anthropicApi: ['apiKey'],
	googlePalmApi: ['apiKey'],
	telegramApi: ['accessToken'],
	supabaseApi: ['host', 'serviceRole'],
	postgres: ['host', 'database', 'user', 'password'],
};

/**
 * Mapping of credential types to URLs where users can obtain their API keys.
 */
export const API_KEY_URLS: Record<string, string> = {
	openAiApi: 'https://platform.openai.com/api-keys',
	anthropicApi: 'https://console.anthropic.com/settings/keys',
	googlePalmApi: 'https://aistudio.google.com/apikey',
	telegramApi: 'https://core.telegram.org/bots#botfather',
	supabaseApi: 'https://supabase.com/dashboard/project/_/settings/api',
};

/**
 * Patterns used to detect OAuth credentials.
 * A credential type containing any of these patterns is considered an OAuth credential.
 */
export const OAUTH_CREDENTIAL_PATTERNS: string[] = ['OAuth2', 'oAuth2', 'OAuth', 'oAuth'];

/**
 * Returns the essential fields for a given credential type.
 * @param credentialType - The credential type name
 * @returns Array of essential field names, or null if the credential type is not curated
 */
export function getEssentialFields(credentialType: string): string[] | null {
	return ESSENTIAL_FIELDS[credentialType] ?? null;
}

/**
 * Returns the URL where users can obtain their API key for a given credential type.
 * @param credentialType - The credential type name
 * @returns The API key URL, or null if not available
 */
export function getApiKeyUrl(credentialType: string): string | null {
	return API_KEY_URLS[credentialType] ?? null;
}

/**
 * Checks if a credential type is an OAuth credential.
 * @param credentialType - The credential type name
 * @returns True if the credential type matches OAuth patterns
 */
export function isOAuthCredential(credentialType: string): boolean {
	return OAUTH_CREDENTIAL_PATTERNS.some((pattern) => credentialType.includes(pattern));
}

/**
 * Checks if a credential type has advanced (non-essential) fields.
 * @param credentialType - The credential type name
 * @param allFieldNames - Array of all field names for this credential type
 * @returns True if there are fields beyond the essential ones
 */
export function hasAdvancedFields(credentialType: string, allFieldNames: string[]): boolean {
	const essentialFields = getEssentialFields(credentialType);
	if (!essentialFields) {
		return false;
	}

	const essentialSet = new Set(essentialFields);
	return allFieldNames.some((fieldName) => !essentialSet.has(fieldName));
}

/**
 * Partitions fields into essential and advanced groups.
 * Essential fields are ordered according to ESSENTIAL_FIELDS configuration.
 * Advanced fields preserve their original order.
 *
 * @param credentialType - The credential type name
 * @param fields - Array of field objects with a name property
 * @returns Object with essential and advanced field arrays
 */
export function partitionFields<T extends { name: string }>(
	credentialType: string,
	fields: T[],
): { essential: T[]; advanced: T[] } {
	const essentialFieldNames = getEssentialFields(credentialType);

	if (!essentialFieldNames) {
		return { essential: [], advanced: fields };
	}

	const essentialSet = new Set(essentialFieldNames);
	const fieldsByName = new Map(fields.map((field) => [field.name, field]));

	// Order essential fields according to ESSENTIAL_FIELDS configuration
	const essential: T[] = [];
	for (const fieldName of essentialFieldNames) {
		const field = fieldsByName.get(fieldName);
		if (field) {
			essential.push(field);
		}
	}

	// Preserve original order for advanced fields
	const advanced = fields.filter((field) => !essentialSet.has(field.name));

	return { essential, advanced };
}
