import { describe, it, expect } from 'vitest';
import {
	ESSENTIAL_FIELDS,
	API_KEY_URLS,
	OAUTH_CREDENTIAL_PATTERNS,
	getEssentialFields,
	getApiKeyUrl,
	isOAuthCredential,
	hasAdvancedFields,
	partitionFields,
} from './essentialFields';

describe('essentialFields', () => {
	describe('ESSENTIAL_FIELDS', () => {
		it('should have essential fields for openAiApi', () => {
			expect(ESSENTIAL_FIELDS.openAiApi).toEqual(['apiKey']);
		});

		it('should have essential fields for anthropicApi', () => {
			expect(ESSENTIAL_FIELDS.anthropicApi).toEqual(['apiKey']);
		});

		it('should have essential fields for googlePalmApi', () => {
			expect(ESSENTIAL_FIELDS.googlePalmApi).toEqual(['apiKey']);
		});

		it('should have essential fields for telegramApi', () => {
			expect(ESSENTIAL_FIELDS.telegramApi).toEqual(['accessToken']);
		});

		it('should have essential fields for supabaseApi', () => {
			expect(ESSENTIAL_FIELDS.supabaseApi).toEqual(['host', 'serviceRole']);
		});

		it('should have essential fields for postgres', () => {
			expect(ESSENTIAL_FIELDS.postgres).toEqual(['host', 'database', 'user', 'password']);
		});
	});

	describe('API_KEY_URLS', () => {
		it('should have URL for openAiApi', () => {
			expect(API_KEY_URLS.openAiApi).toBe('https://platform.openai.com/api-keys');
		});

		it('should have URL for anthropicApi', () => {
			expect(API_KEY_URLS.anthropicApi).toBe('https://console.anthropic.com/settings/keys');
		});

		it('should have URL for googlePalmApi', () => {
			expect(API_KEY_URLS.googlePalmApi).toBe('https://aistudio.google.com/apikey');
		});

		it('should have URL for telegramApi', () => {
			expect(API_KEY_URLS.telegramApi).toBe('https://core.telegram.org/bots#botfather');
		});

		it('should have URL for supabaseApi', () => {
			expect(API_KEY_URLS.supabaseApi).toBe(
				'https://supabase.com/dashboard/project/_/settings/api',
			);
		});
	});

	describe('OAUTH_CREDENTIAL_PATTERNS', () => {
		it('should contain OAuth patterns', () => {
			expect(OAUTH_CREDENTIAL_PATTERNS).toContain('OAuth2');
			expect(OAUTH_CREDENTIAL_PATTERNS).toContain('oAuth2');
			expect(OAUTH_CREDENTIAL_PATTERNS).toContain('OAuth');
			expect(OAUTH_CREDENTIAL_PATTERNS).toContain('oAuth');
		});
	});

	describe('getEssentialFields', () => {
		it('should return essential fields for known credential types', () => {
			expect(getEssentialFields('openAiApi')).toEqual(['apiKey']);
			expect(getEssentialFields('postgres')).toEqual(['host', 'database', 'user', 'password']);
		});

		it('should return null for unknown credential types', () => {
			expect(getEssentialFields('unknownCredential')).toBeNull();
			expect(getEssentialFields('randomType')).toBeNull();
		});
	});

	describe('getApiKeyUrl', () => {
		it('should return API key URL for known credential types', () => {
			expect(getApiKeyUrl('openAiApi')).toBe('https://platform.openai.com/api-keys');
			expect(getApiKeyUrl('anthropicApi')).toBe('https://console.anthropic.com/settings/keys');
		});

		it('should return null for unknown credential types', () => {
			expect(getApiKeyUrl('unknownCredential')).toBeNull();
			expect(getApiKeyUrl('postgres')).toBeNull();
		});
	});

	describe('isOAuthCredential', () => {
		it('should return true for OAuth credential types', () => {
			expect(isOAuthCredential('googleOAuth2Api')).toBe(true);
			expect(isOAuthCredential('slackOAuth2Api')).toBe(true);
			expect(isOAuthCredential('githubOAuth2Api')).toBe(true);
		});

		it('should return true for oAuth credential types (lowercase)', () => {
			expect(isOAuthCredential('spotifyoAuth2Api')).toBe(true);
		});

		it('should return false for non-OAuth credential types', () => {
			expect(isOAuthCredential('openAiApi')).toBe(false);
			expect(isOAuthCredential('postgres')).toBe(false);
			expect(isOAuthCredential('telegramApi')).toBe(false);
		});
	});

	describe('hasAdvancedFields', () => {
		it('should return true when there are non-essential fields', () => {
			const allFields = ['apiKey', 'baseUrl', 'timeout'];
			expect(hasAdvancedFields('openAiApi', allFields)).toBe(true);
		});

		it('should return false when all fields are essential', () => {
			const allFields = ['apiKey'];
			expect(hasAdvancedFields('openAiApi', allFields)).toBe(false);
		});

		it('should return false for unknown credential types', () => {
			const allFields = ['field1', 'field2'];
			expect(hasAdvancedFields('unknownCredential', allFields)).toBe(false);
		});

		it('should handle postgres with all essential fields', () => {
			const allFields = ['host', 'database', 'user', 'password'];
			expect(hasAdvancedFields('postgres', allFields)).toBe(false);
		});

		it('should handle postgres with advanced fields', () => {
			const allFields = ['host', 'database', 'user', 'password', 'port', 'ssl'];
			expect(hasAdvancedFields('postgres', allFields)).toBe(true);
		});
	});

	describe('partitionFields', () => {
		it('should partition fields into essential and advanced', () => {
			const fields = [
				{ name: 'baseUrl', label: 'Base URL' },
				{ name: 'apiKey', label: 'API Key' },
				{ name: 'timeout', label: 'Timeout' },
			];

			const result = partitionFields('openAiApi', fields);

			expect(result.essential).toHaveLength(1);
			expect(result.essential[0].name).toBe('apiKey');
			expect(result.advanced).toHaveLength(2);
			expect(result.advanced.map((f) => f.name)).toEqual(['baseUrl', 'timeout']);
		});

		it('should preserve order from ESSENTIAL_FIELDS for essential fields', () => {
			const fields = [
				{ name: 'password', label: 'Password' },
				{ name: 'host', label: 'Host' },
				{ name: 'port', label: 'Port' },
				{ name: 'database', label: 'Database' },
				{ name: 'user', label: 'User' },
			];

			const result = partitionFields('postgres', fields);

			// Should follow ESSENTIAL_FIELDS order: ['host', 'database', 'user', 'password']
			expect(result.essential.map((f) => f.name)).toEqual(['host', 'database', 'user', 'password']);
			expect(result.advanced).toHaveLength(1);
			expect(result.advanced[0].name).toBe('port');
		});

		it('should return all fields as advanced for unknown credential types', () => {
			const fields = [
				{ name: 'field1', label: 'Field 1' },
				{ name: 'field2', label: 'Field 2' },
			];

			const result = partitionFields('unknownCredential', fields);

			expect(result.essential).toHaveLength(0);
			expect(result.advanced).toHaveLength(2);
		});

		it('should handle empty fields array', () => {
			const result = partitionFields('openAiApi', []);

			expect(result.essential).toHaveLength(0);
			expect(result.advanced).toHaveLength(0);
		});

		it('should preserve advanced fields in their original order', () => {
			const fields = [
				{ name: 'zebra', label: 'Zebra' },
				{ name: 'apiKey', label: 'API Key' },
				{ name: 'alpha', label: 'Alpha' },
				{ name: 'beta', label: 'Beta' },
			];

			const result = partitionFields('openAiApi', fields);

			expect(result.advanced.map((f) => f.name)).toEqual(['zebra', 'alpha', 'beta']);
		});
	});
});
