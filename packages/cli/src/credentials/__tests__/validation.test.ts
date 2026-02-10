import { GLOBAL_OWNER_ROLE, GLOBAL_MEMBER_ROLE } from '@n8n/db';
import type { User } from '@n8n/db';
import { mock } from 'jest-mock-extended';

import type { SecretsProviderAccessCheckService } from '@/modules/external-secrets.ee/secret-provider-access-check.service.ee';

import {
	validateExternalSecretsPermissions,
	isChangingExternalSecretExpression,
	validateAccessToReferencedSecretProviders,
} from '../validation';

describe('Credentials Validation', () => {
	const ownerUser = mock<User>({ id: 'owner-id', role: GLOBAL_OWNER_ROLE });
	const memberUser = mock<User>({ id: 'member-id', role: GLOBAL_MEMBER_ROLE });
	const errorMessage = 'Lacking permissions to reference external secrets in credentials';

	describe('validateExternalSecretsPermissions', () => {
		it('should pass when credential data contains no external secrets', () => {
			const data = {
				apiKey: 'regular-key',
				domain: 'example.com',
			};

			expect(() => validateExternalSecretsPermissions(memberUser, data)).not.toThrow();
		});

		it('should pass when credential data contains external secrets and user has permission', () => {
			const data = {
				apiKey: '={{ $secrets.myApiKey }}',
				domain: 'example.com',
			};

			expect(() => validateExternalSecretsPermissions(ownerUser, data)).not.toThrow();
		});

		it('should throw BadRequestError when user lacks externalSecret:list permission', () => {
			const data = {
				apiKey: '={{ $secrets.myApiKey }}',
				domain: 'example.com',
			};

			expect(() => validateExternalSecretsPermissions(memberUser, data)).toThrow(errorMessage);
		});

		it('should throw when user lacks permission and uses nested external secrets', () => {
			const data = {
				apiKey: 'regular-key',
				advanced: {
					token: '={{ $secrets.myToken }}',
				},
			};

			expect(() => validateExternalSecretsPermissions(memberUser, data)).toThrow(errorMessage);
		});

		it('should pass when user has permission and uses nested external secrets', () => {
			const data = {
				apiKey: 'regular-key',
				advanced: {
					token: '={{ $secrets.myToken }}',
				},
			};

			expect(() => validateExternalSecretsPermissions(ownerUser, data)).not.toThrow();
		});

		it('should throw when updating nested credential with external secret without permission', () => {
			const existingData = {
				apiKey: 'key',
				config: { token: 'old-token' },
			};
			const newData = {
				apiKey: 'key',
				config: { token: '={{ $secrets.newToken }}' },
			};

			expect(() => validateExternalSecretsPermissions(memberUser, newData, existingData)).toThrow(
				errorMessage,
			);
		});

		describe('bracket notation', () => {
			it('should throw when user lacks permission and uses bracket notation', () => {
				const data = {
					apiKey: "={{ $secrets['vault']['key'] }}",
				};

				expect(() => validateExternalSecretsPermissions(memberUser, data)).toThrow(errorMessage);
			});

			it('should pass when user has permission and uses bracket notation', () => {
				const data = {
					apiKey: "={{ $secrets['vault']['key'] }}",
				};

				expect(() => validateExternalSecretsPermissions(ownerUser, data)).not.toThrow();
			});

			it('should throw when user lacks permission and uses mixed notation', () => {
				const data = {
					apiKey: "={{ $secrets.vault['nested'] }}",
				};

				expect(() => validateExternalSecretsPermissions(memberUser, data)).toThrow(errorMessage);
			});
		});
	});

	describe('isChangingExternalSecretExpression', () => {
		it('should return true when adding a new external secret expression', () => {
			const existingData = { apiKey: 'plain-value' };
			const newData = { apiKey: '={{ $secrets.myKey }}' };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(true);
		});

		it('should return true when modifying an existing external secret expression', () => {
			const existingData = { apiKey: '={{ $secrets.oldKey }}' };
			const newData = { apiKey: '={{ $secrets.newKey }}' };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(true);
		});

		it('should return false when keeping external secret unchanged while modifying other fields', () => {
			const existingData = { apiKey: '={{ $secrets.myKey }}', domain: 'old.com' };
			const newData = { apiKey: '={{ $secrets.myKey }}', domain: 'new.com' };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(false);
		});

		it('should return false when removing an external secret expression', () => {
			const existingData = { apiKey: '={{ $secrets.myKey }}' };
			const newData = { apiKey: 'plain-value' };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(false);
		});

		it('should return false when neither version contains external secrets', () => {
			const existingData = { apiKey: 'value1' };
			const newData = { apiKey: 'value2' };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(false);
		});

		it('should return true when one external secret changed among multiple fields', () => {
			const existingData = { key1: '={{ $secrets.a }}', key2: '={{ $secrets.b }}' };
			const newData = { key1: '={{ $secrets.a }}', key2: '={{ $secrets.c }}' };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(true);
		});

		it('should return true when adding external secret in nested object', () => {
			const existingData = { apiKey: 'plain', config: { token: 'old-token' } };
			const newData = { apiKey: 'plain', config: { token: '={{ $secrets.myToken }}' } };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(true);
		});

		it('should return true when modifying external secret in nested object', () => {
			const existingData = { apiKey: 'plain', config: { token: '$secrets.oldToken' } };
			const newData = { apiKey: 'plain', config: { token: '$secrets.newToken' } };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(true);
		});

		it('should return false when keeping nested external secret unchanged', () => {
			const existingData = { apiKey: 'plain', config: { token: '={{ $secrets.myToken }}' } };
			const newData = { apiKey: 'plain', config: { token: '={{ $secrets.myToken }}' } };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(false);
		});

		it('should return false when removing nested external secret', () => {
			const existingData = { config: { token: '={{ $secrets.myToken }}' } };
			const newData = { config: { token: 'plain-value' } };

			expect(isChangingExternalSecretExpression(newData, existingData)).toBe(false);
		});

		describe('bracket notation', () => {
			it('should return true when adding bracket notation external secret', () => {
				const existingData = { apiKey: 'plain-value' };
				const newData = { apiKey: "={{ $secrets['vault']['key'] }}" };

				expect(isChangingExternalSecretExpression(newData, existingData)).toBe(true);
			});

			it('should return true when changing from dot to bracket notation', () => {
				const existingData = { apiKey: '={{ $secrets.vault.key }}' };
				const newData = { apiKey: "={{ $secrets['vault']['key'] }}" };

				expect(isChangingExternalSecretExpression(newData, existingData)).toBe(true);
			});

			it('should return false when keeping bracket notation unchanged', () => {
				const existingData = { apiKey: "={{ $secrets['vault']['key'] }}" };
				const newData = { apiKey: "={{ $secrets['vault']['key'] }}" };

				expect(isChangingExternalSecretExpression(newData, existingData)).toBe(false);
			});
		});
	});

	describe('validateAccessToReferencedSecretProviders', () => {
		const projectId = 'test-project-id';
		let accessCheckService: SecretsProviderAccessCheckService;

		beforeEach(() => {
			accessCheckService = mock<SecretsProviderAccessCheckService>();
		});

		it('should handle provider name with underscores, hyphens and numbers', async () => {
			const data = {
				apiKey: '={{ $secrets.my_provider-123.key }}',
			};

			accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(true);

			await expect(
				validateAccessToReferencedSecretProviders(projectId, data, accessCheckService),
			).resolves.toBeUndefined();

			expect(accessCheckService.canAccessProviderFromProject).toHaveBeenCalledWith(
				'my_provider-123',
				projectId,
			);
		});

		it('should pass validation when credential has only regular values', async () => {
			const data = {
				apiKey: 'regular-value',
				token: 'another-value',
			};

			await expect(
				validateAccessToReferencedSecretProviders(projectId, data, accessCheckService),
			).resolves.toBeUndefined();
		});

		it('should pass when project has access to the only referenced provider', async () => {
			const data = {
				apiKey: '={{ $secrets.vault.mykey }}',
			};

			accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(true);

			await validateAccessToReferencedSecretProviders(projectId, data, accessCheckService);

			expect(accessCheckService.canAccessProviderFromProject).toHaveBeenCalledWith(
				'vault',
				projectId,
			);
		});

		it('should pass when project has access to multiple referenceded provider', async () => {
			const data = {
				apiKey: '={{ $secrets.vault.key }}',
				token: '={{ $secrets.aws.secret }}',
			};

			accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(true);

			await expect(
				validateAccessToReferencedSecretProviders(projectId, data, accessCheckService),
			).resolves.toBeUndefined();

			expect((accessCheckService.canAccessProviderFromProject as jest.Mock).mock.calls).toEqual([
				['vault', projectId],
				['aws', projectId],
			]);
		});

		it('should throw error when user lacks access to referenced provider', async () => {
			const data = {
				apiKey: '={{ $secrets.vault.mykey }}',
			};

			accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(false);

			await expect(
				validateAccessToReferencedSecretProviders(projectId, data, accessCheckService),
			).rejects.toThrow(
				'The secret provider "vault" used in "apiKey" does not exist in this project',
			);
		});

		it('should throw listing all inaccessible providers in the provided data', async () => {
			const data = {
				apiKey: '={{ $secrets.outsideProvider.key }}',
				anotherApiKey: '={{ $secrets.anotherOutsideProvider.key }}',
			};

			accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(false);

			await expect(
				validateAccessToReferencedSecretProviders(projectId, data, accessCheckService),
			).rejects.toThrow(
				'The secret providers "outsideProvider", "anotherOutsideProvider" do not exist in this project',
			);
		});

		describe('bracket notation', () => {
			it('should pass when project has access to provider referenced using bracket notation', async () => {
				const data = {
					apiKey: "={{ $secrets['vault']['mykey'] }}",
				};

				accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(true);

				await expect(
					validateAccessToReferencedSecretProviders(projectId, data, accessCheckService),
				).resolves.toBeUndefined();

				expect(accessCheckService.canAccessProviderFromProject).toHaveBeenCalledWith(
					'vault',
					projectId,
				);
			});

			it('should throw error when user lacks access to referenced provider', async () => {
				const data = {
					apiKey: "={{ $secrets['vault']['mykey'] }}",
				};

				accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(false);

				await expect(
					validateAccessToReferencedSecretProviders(projectId, data, accessCheckService),
				).rejects.toThrow(
					'The secret provider "vault" used in "apiKey" does not exist in this project',
				);
			});
		});

		describe('nested credential data', () => {
			it('should pass when external secrets in nested objects are accessible', async () => {
				const data = {
					config: {
						database: {
							password: '={{ $secrets.vault.dbpass }}',
						},
					},
				};

				accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(true);

				await validateAccessToReferencedSecretProviders(projectId, data, accessCheckService);
			});

			it('should throw with nested field path when external secrets referenced in nested objects are inaccessible', async () => {
				const data = {
					config: {
						database: {
							password: '={{ $secrets.vault.dbpass }}',
						},
					},
				};

				accessCheckService.canAccessProviderFromProject = jest.fn().mockResolvedValue(false);

				await expect(
					validateAccessToReferencedSecretProviders(projectId, data, accessCheckService),
				).rejects.toThrow(
					'The secret provider "vault" used in "config.database.password" does not exist in this project',
				);
			});
		});
	});
});
