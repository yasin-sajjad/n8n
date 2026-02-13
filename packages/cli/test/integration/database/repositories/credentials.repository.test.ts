import { testDb } from '@n8n/backend-test-utils';
import { CredentialsRepository, SharedCredentialsRepository } from '@n8n/db';
import { Container } from '@n8n/di';
import type { Scope } from '@n8n/permissions';

// Test helper functions
async function shareCredentialsToProject(
	credentials: Array<{ id: string }>,
	projectId: string,
	role: 'credential:user' | 'credential:owner',
) {
	const sharedCredentialsRepository = Container.get(SharedCredentialsRepository);
	await sharedCredentialsRepository.save(
		credentials.map((c) => ({
			credentialsId: c.id,
			projectId,
			role,
		})),
	);
}

describe('CredentialsRepository', () => {
	beforeAll(async () => {
		await testDb.init();
	});

	beforeEach(async () => {
		await testDb.truncate(['SharedCredentials', 'CredentialsEntity']);
	});

	afterAll(async () => {
		await testDb.terminate();
	});

	describe('getManyAndCountWithSharingSubquery', () => {
		let credentialsRepository: CredentialsRepository;

		beforeEach(async () => {
			await testDb.truncate([
				'SharedCredentials',
				'ProjectRelation',
				'CredentialsEntity',
				'Project',
				'User',
			]);
			credentialsRepository = Container.get(CredentialsRepository);
		});

		it('should fetch credentials using subquery for standard user with roles', async () => {
			// ARRANGE
			const { createMember } = await import('../../shared/db/users');
			const { createTeamProject, linkUserToProject } = await import('@n8n/backend-test-utils');
			const { createCredentials } = await import('../../shared/db/credentials');

			const member = await createMember();
			const teamProject = await createTeamProject('test-project');
			await linkUserToProject(member, teamProject, 'project:editor');

			const credentials = await Promise.all([
				createCredentials({ name: 'Team Credential 1', type: 'googleApi', data: '' }),
				createCredentials({ name: 'Team Credential 2', type: 'slackApi', data: '' }),
			]);

			await shareCredentialsToProject(credentials, teamProject.id, 'credential:user');

			const sharingOptions = {
				scopes: ['credential:read'] as Scope[],
				projectRoles: ['project:editor'],
				credentialRoles: ['credential:user'],
			};

			// ACT
			const result = await credentialsRepository.getManyAndCountWithSharingSubquery(
				member,
				sharingOptions,
				{},
			);

			// ASSERT
			expect(result.credentials).toHaveLength(2);
			expect(result.count).toBe(2);
			expect(result.credentials.map((c) => c.name)).toEqual(
				expect.arrayContaining(['Team Credential 1', 'Team Credential 2']),
			);
		});

		it('should handle personal project filtering correctly', async () => {
			// ARRANGE
			const { createOwner } = await import('../../shared/db/users');
			const { getPersonalProject } = await import('@n8n/backend-test-utils');
			const { createCredentials } = await import('../../shared/db/credentials');

			const owner = await createOwner();
			const personalProject = await getPersonalProject(owner);

			const credentials = await Promise.all([
				createCredentials({ name: 'Personal Credential 1', type: 'githubApi', data: '' }),
				createCredentials({ name: 'Personal Credential 2', type: 'googleApi', data: '' }),
			]);

			await shareCredentialsToProject(credentials, personalProject.id, 'credential:owner');

			// ACT
			const result = await credentialsRepository.getManyAndCountWithSharingSubquery(
				owner,
				{ isPersonalProject: true, personalProjectOwnerId: owner.id },
				{ filter: { projectId: personalProject.id } },
			);

			// ASSERT
			expect(result.credentials).toHaveLength(2);
			expect(result.count).toBe(2);
		});

		it('should handle onlySharedWithMe filter correctly', async () => {
			// ARRANGE
			const { createMember } = await import('../../shared/db/users');
			const { getPersonalProject } = await import('@n8n/backend-test-utils');
			const { createCredentials } = await import('../../shared/db/credentials');

			const member = await createMember();
			const memberPersonalProject = await getPersonalProject(member);

			const sharedCredential = await createCredentials({
				name: 'Shared Credential',
				type: 'slackApi',
				data: '',
			});
			await shareCredentialsToProject(
				[sharedCredential],
				memberPersonalProject.id,
				'credential:user',
			);

			// ACT
			const result = await credentialsRepository.getManyAndCountWithSharingSubquery(
				member,
				{ onlySharedWithMe: true },
				{},
			);

			// ASSERT
			expect(result.credentials).toHaveLength(1);
			expect(result.count).toBe(1);
			expect(result.credentials[0].name).toBe('Shared Credential');
		});

		it('should apply name filter correctly with subquery approach', async () => {
			// ARRANGE
			const { createOwner } = await import('../../shared/db/users');
			const { getPersonalProject } = await import('@n8n/backend-test-utils');
			const { createCredentials } = await import('../../shared/db/credentials');

			const owner = await createOwner();
			const personalProject = await getPersonalProject(owner);

			const credentials = await Promise.all([
				createCredentials({ name: 'Test Credential Alpha', type: 'googleApi', data: '' }),
				createCredentials({ name: 'Test Credential Beta', type: 'slackApi', data: '' }),
				createCredentials({ name: 'Production Credential', type: 'githubApi', data: '' }),
			]);

			await shareCredentialsToProject(credentials, personalProject.id, 'credential:owner');

			// ACT
			const result = await credentialsRepository.getManyAndCountWithSharingSubquery(
				owner,
				{ isPersonalProject: true, personalProjectOwnerId: owner.id },
				{ filter: { projectId: personalProject.id, name: 'Test' } },
			);

			// ASSERT
			expect(result.credentials).toHaveLength(2);
			expect(result.count).toBe(2);
			expect(result.credentials.map((c) => c.name)).toEqual(
				expect.arrayContaining(['Test Credential Alpha', 'Test Credential Beta']),
			);
		});

		it('should apply type filter correctly with subquery approach', async () => {
			// ARRANGE
			const { createOwner } = await import('../../shared/db/users');
			const { getPersonalProject } = await import('@n8n/backend-test-utils');
			const { createCredentials } = await import('../../shared/db/credentials');

			const owner = await createOwner();
			const personalProject = await getPersonalProject(owner);

			const credentials = await Promise.all([
				createCredentials({ name: 'Google Credential 1', type: 'googleApi', data: '' }),
				createCredentials({ name: 'Google Credential 2', type: 'googleApi', data: '' }),
				createCredentials({ name: 'Slack Credential', type: 'slackApi', data: '' }),
			]);

			await shareCredentialsToProject(credentials, personalProject.id, 'credential:owner');

			// ACT
			const result = await credentialsRepository.getManyAndCountWithSharingSubquery(
				owner,
				{ isPersonalProject: true, personalProjectOwnerId: owner.id },
				{ filter: { projectId: personalProject.id, type: 'google', data: '' } },
			);

			// ASSERT
			expect(result.credentials).toHaveLength(2);
			expect(result.count).toBe(2);
			expect(result.credentials.map((c) => c.name)).toEqual(
				expect.arrayContaining(['Google Credential 1', 'Google Credential 2']),
			);
		});

		it('should handle pagination correctly with subquery approach', async () => {
			// ARRANGE
			const { createOwner } = await import('../../shared/db/users');
			const { getPersonalProject } = await import('@n8n/backend-test-utils');
			const { createCredentials } = await import('../../shared/db/credentials');

			const owner = await createOwner();
			const personalProject = await getPersonalProject(owner);

			const credentials = await Promise.all([
				createCredentials({ name: 'Credential 1', type: 'googleApi', data: '' }),
				createCredentials({ name: 'Credential 2', type: 'slackApi', data: '' }),
				createCredentials({ name: 'Credential 3', type: 'githubApi', data: '' }),
				createCredentials({ name: 'Credential 4', type: 'googleApi', data: '' }),
				createCredentials({ name: 'Credential 5', type: 'slackApi', data: '' }),
			]);

			await shareCredentialsToProject(credentials, personalProject.id, 'credential:owner');

			const sharingOptions = { isPersonalProject: true, personalProjectOwnerId: owner.id };

			// ACT
			const page1 = await credentialsRepository.getManyAndCountWithSharingSubquery(
				owner,
				sharingOptions,
				{
					filter: { projectId: personalProject.id },
					take: 2,
					skip: 0,
				},
			);

			const page2 = await credentialsRepository.getManyAndCountWithSharingSubquery(
				owner,
				sharingOptions,
				{
					filter: { projectId: personalProject.id },
					take: 2,
					skip: 2,
				},
			);

			// ASSERT
			expect(page1.credentials).toHaveLength(2);
			expect(page1.count).toBe(5);
			expect(page2.credentials).toHaveLength(2);
			expect(page2.count).toBe(5);

			// Ensure different credentials in each page
			const page1Ids = page1.credentials.map((c) => c.id);
			const page2Ids = page2.credentials.map((c) => c.id);
			expect(page1Ids).not.toEqual(expect.arrayContaining(page2Ids));
		});

		it('should correctly filter credentials by project when credentials belong to multiple projects', async () => {
			// ARRANGE
			const { createMember } = await import('../../shared/db/users');
			const { createTeamProject, linkUserToProject } = await import('@n8n/backend-test-utils');
			const { createCredentials } = await import('../../shared/db/credentials');

			const member = await createMember();
			const projectA = await createTeamProject('Project A');
			const projectB = await createTeamProject('Project B');
			await linkUserToProject(member, projectA, 'project:editor');
			await linkUserToProject(member, projectB, 'project:editor');

			// Create credentials and share to both projects
			const sharedCredential = await createCredentials({
				name: 'Shared Credential',
				type: 'googleApi',
				data: '',
			});
			const projectAOnlyCredential = await createCredentials({
				name: 'Project A Credential',
				type: 'slackApi',
				data: '',
			});
			const projectBOnlyCredential = await createCredentials({
				name: 'Project B Credential',
				type: 'githubApi',
				data: '',
			});

			await shareCredentialsToProject(
				[sharedCredential, projectAOnlyCredential],
				projectA.id,
				'credential:user',
			);
			await shareCredentialsToProject(
				[sharedCredential, projectBOnlyCredential],
				projectB.id,
				'credential:user',
			);

			const scopes: Scope[] = ['credential:read'];
			const projectRoles = ['project:editor'];
			const credentialRoles = ['credential:user'];

			// ACT - Filter by project A using new approach
			const newResultA = await credentialsRepository.getManyAndCountWithSharingSubquery(
				member,
				{ scopes, projectRoles, credentialRoles },
				{ filter: { projectId: projectA.id } },
			);

			// ACT - Filter by project B using new approach
			const newResultB = await credentialsRepository.getManyAndCountWithSharingSubquery(
				member,
				{ scopes, projectRoles, credentialRoles },
				{ filter: { projectId: projectB.id } },
			);

			// ASSERT
			expect(newResultA.credentials).toHaveLength(2);
			expect(newResultA.credentials.map((c) => c.name)).toEqual(
				expect.arrayContaining(['Shared Credential', 'Project A Credential']),
			);

			expect(newResultB.credentials).toHaveLength(2);
			expect(newResultB.credentials.map((c) => c.name)).toEqual(
				expect.arrayContaining(['Shared Credential', 'Project B Credential']),
			);
		});

		it('should correctly isolate credentials by user - each user sees only their credentials', async () => {
			// ARRANGE
			const { createMember } = await import('../../shared/db/users');
			const { createTeamProject, linkUserToProject } = await import('@n8n/backend-test-utils');
			const { createCredentials } = await import('../../shared/db/credentials');

			const userA = await createMember();
			const userB = await createMember();
			const projectA = await createTeamProject('User A Project');
			const projectB = await createTeamProject('User B Project');
			await linkUserToProject(userA, projectA, 'project:editor');
			await linkUserToProject(userB, projectB, 'project:editor');

			// Create credentials for each user
			const userACredentials = await Promise.all([
				createCredentials({ name: 'User A Credential 1', type: 'googleApi', data: '' }),
				createCredentials({ name: 'User A Credential 2', type: 'slackApi', data: '' }),
			]);
			const userBCredentials = await Promise.all([
				createCredentials({ name: 'User B Credential 1', type: 'githubApi', data: '' }),
				createCredentials({ name: 'User B Credential 2', type: 'googleApi', data: '' }),
			]);

			await shareCredentialsToProject(userACredentials, projectA.id, 'credential:user');
			await shareCredentialsToProject(userBCredentials, projectB.id, 'credential:user');

			const scopes: Scope[] = ['credential:read'];
			const projectRoles = ['project:editor'];
			const credentialRoles = ['credential:user'];

			// ACT - Query credentials for User A (new approach)
			const newResultA = await credentialsRepository.getManyAndCountWithSharingSubquery(
				userA,
				{ scopes, projectRoles, credentialRoles },
				{},
			);

			// ACT - Query credentials for User B (new approach)
			const newResultB = await credentialsRepository.getManyAndCountWithSharingSubquery(
				userB,
				{ scopes, projectRoles, credentialRoles },
				{},
			);

			// ASSERT
			expect(newResultA.credentials).toHaveLength(2);
			expect(newResultA.credentials.map((c) => c.name)).toEqual(
				expect.arrayContaining(['User A Credential 1', 'User A Credential 2']),
			);

			expect(newResultB.credentials).toHaveLength(2);
			expect(newResultB.credentials.map((c) => c.name)).toEqual(
				expect.arrayContaining(['User B Credential 1', 'User B Credential 2']),
			);

			// Verify no overlap
			const credentialAIds = newResultA.credentials.map((c) => c.id);
			const credentialBIds = newResultB.credentials.map((c) => c.id);
			expect(credentialAIds).not.toEqual(expect.arrayContaining(credentialBIds));
		});
	});
});
