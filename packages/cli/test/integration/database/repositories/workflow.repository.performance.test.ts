import { testDb } from '@n8n/backend-test-utils';
import { WorkflowRepository } from '@n8n/db';
import { Container } from '@n8n/di';

/**
 * Performance benchmark test comparing old (pre-fetch IDs) vs new (subquery) approaches
 * for fetching workflows with access control.
 *
 * Run with: pnpm test:integration workflow.repository.performance.test.ts
 */
describe('WorkflowRepository Performance Benchmark', () => {
	let workflowRepository: WorkflowRepository;

	beforeAll(async () => {
		await testDb.init();
		workflowRepository = Container.get(WorkflowRepository);
	});

	beforeEach(async () => {
		await testDb.truncate([
			'SharedWorkflow',
			'ProjectRelation',
			'WorkflowEntity',
			'Project',
			'User',
		]);
	});

	afterAll(async () => {
		await testDb.terminate();
	});

	describe('Performance comparison with large datasets', () => {
		it('should benchmark old vs new approach with 500 workflows', async () => {
			//
			// ARRANGE - Create test data
			//
			const { createOwner } = await import('../../shared/db/users');
			const { createTeamProject, linkUserToProject } = await import('@n8n/backend-test-utils');
			const { SharedWorkflowRepository } = await import('@n8n/db');
			const { createWorkflow } = await import('@n8n/backend-test-utils');
			const { WorkflowSharingService } = await import('@/workflows/workflow-sharing.service');
			const { RoleService } = await import('@/services/role.service');

			const owner = await createOwner();
			const teamProject = await createTeamProject('benchmark-project');
			await linkUserToProject(owner, teamProject, 'project:editor');

			// Create 500 workflows (SQLite has expression tree depth limit of 1000)
			const workflowCount = 500;
			console.log(`\nCreating ${workflowCount} workflows...`);
			const createStart = Date.now();

			const workflows = [];
			for (let i = 0; i < workflowCount; i++) {
				workflows.push(await createWorkflow({ name: `Benchmark Workflow ${i}` }));
			}

			const sharedWorkflowRepository = Container.get(SharedWorkflowRepository);
			await sharedWorkflowRepository.save(
				workflows.map((w) => ({
					workflowId: w.id,
					projectId: teamProject.id,
					role: 'workflow:editor',
				})),
			);

			const createTime = Date.now() - createStart;
			console.log(`Created ${workflowCount} workflows in ${createTime}ms`);

			const roleService = Container.get(RoleService);
			const workflowSharingService = Container.get(WorkflowSharingService);

			const scopes: any = ['workflow:read'];
			const projectRoles = await roleService.rolesWithScope('project', scopes);
			const workflowRoles = await roleService.rolesWithScope('workflow', scopes);

			//
			// BENCHMARK - Old Approach (pre-fetch IDs then query)
			//
			console.log('\n=== OLD APPROACH (Pre-fetch IDs) ===');
			const oldStart = Date.now();

			const sharedWorkflowIds = await workflowSharingService.getSharedWorkflowIds(owner, {
				scopes,
			});
			const oldFetchTime = Date.now() - oldStart;
			console.log(`1. Fetched ${sharedWorkflowIds.length} workflow IDs in ${oldFetchTime}ms`);

			const oldQueryStart = Date.now();
			const oldResult = await workflowRepository.getManyAndCount(sharedWorkflowIds, {});
			const oldQueryTime = Date.now() - oldQueryStart;
			console.log(`2. Queried workflows in ${oldQueryTime}ms`);

			const oldTotalTime = Date.now() - oldStart;
			console.log(`TOTAL: ${oldTotalTime}ms (${oldFetchTime}ms + ${oldQueryTime}ms)`);

			//
			// BENCHMARK - New Approach (subquery)
			//
			console.log('\n=== NEW APPROACH (Subquery) ===');
			const newStart = Date.now();

			const newResult = await workflowRepository.getManyAndCountWithSharingSubquery(
				owner,
				{
					scopes,
					projectRoles,
					workflowRoles,
				},
				{},
			);

			const newTotalTime = Date.now() - newStart;
			console.log(`TOTAL: ${newTotalTime}ms (single query)`);

			//
			// RESULTS
			//
			console.log('\n=== PERFORMANCE COMPARISON ===');
			console.log(`Old approach: ${oldTotalTime}ms`);
			console.log(`New approach: ${newTotalTime}ms`);

			const improvement = oldTotalTime - newTotalTime;
			const improvementPercent = ((improvement / oldTotalTime) * 100).toFixed(1);

			if (improvement > 0) {
				console.log(
					`✓ New approach is ${improvement}ms faster (${improvementPercent}% improvement)`,
				);
			} else {
				console.log(
					`✗ New approach is ${Math.abs(improvement)}ms slower (${Math.abs(
						Number(improvementPercent),
					)}% regression)`,
				);
			}

			//
			// VERIFY - Results should be identical
			//
			expect(newResult.count).toBe(oldResult.count);
			expect(newResult.workflows).toHaveLength(oldResult.workflows.length);
			expect(newResult.count).toBe(workflowCount);
		}, 60000); // 60 second timeout for large dataset

		it('should benchmark with pagination (100 workflows, paginated)', async () => {
			//
			// ARRANGE
			//
			const { createOwner } = await import('../../shared/db/users');
			const { getPersonalProject } = await import('@n8n/backend-test-utils');
			const { SharedWorkflowRepository } = await import('@n8n/db');
			const { createWorkflow } = await import('@n8n/backend-test-utils');
			const { WorkflowSharingService } = await import('@/workflows/workflow-sharing.service');

			const owner = await createOwner();
			const personalProject = await getPersonalProject(owner);

			// Create 100 workflows
			const workflowCount = 100;
			const workflows = [];
			for (let i = 0; i < workflowCount; i++) {
				workflows.push(await createWorkflow({ name: `Page Workflow ${i}` }));
			}

			const sharedWorkflowRepository = Container.get(SharedWorkflowRepository);
			await sharedWorkflowRepository.save(
				workflows.map((w) => ({
					workflowId: w.id,
					projectId: personalProject.id,
					role: 'workflow:owner',
				})),
			);

			const workflowSharingService = Container.get(WorkflowSharingService);
			const scopes: any = ['workflow:read'];

			const options = {
				filter: { projectId: personalProject.id },
				take: 10,
				skip: 0,
			};

			//
			// BENCHMARK - Old Approach
			//
			const oldStart = Date.now();
			const sharedWorkflowIds = await workflowSharingService.getSharedWorkflowIds(owner, {
				scopes,
				projectId: personalProject.id,
			});
			const oldResult = await workflowRepository.getManyAndCount(sharedWorkflowIds, options);
			const oldTime = Date.now() - oldStart;

			//
			// BENCHMARK - New Approach
			//
			const newStart = Date.now();
			const newResult = await workflowRepository.getManyAndCountWithSharingSubquery(
				owner,
				{
					isPersonalProject: true,
					personalProjectOwnerId: owner.id,
				},
				options,
			);
			const newTime = Date.now() - newStart;

			//
			// RESULTS
			//
			console.log('\n=== PAGINATION BENCHMARK ===');
			console.log(`Old approach: ${oldTime}ms`);
			console.log(`New approach: ${newTime}ms`);

			//
			// VERIFY
			//
			expect(newResult.count).toBe(oldResult.count);
			expect(newResult.workflows).toHaveLength(oldResult.workflows.length);
			expect(newResult.workflows).toHaveLength(10); // Paginated to 10
		}, 30000);

		it('should benchmark at large scale with 20k workflows', async () => {
			//
			// ARRANGE - Create large dataset
			//
			const { createOwner } = await import('../../shared/db/users');
			const { getPersonalProject } = await import('@n8n/backend-test-utils');
			const { SharedWorkflowRepository } = await import('@n8n/db');
			const { createWorkflow } = await import('@n8n/backend-test-utils');
			const { WorkflowSharingService } = await import('@/workflows/workflow-sharing.service');
			const { RoleService } = await import('@/services/role.service');

			const owner = await createOwner();
			const personalProject = await getPersonalProject(owner);

			// Create 20,000 workflows - large scale but avoids SQL variables limit
			const workflowCount = 20000;
			console.log(`\n=== LARGE SCALE BENCHMARK (${workflowCount.toLocaleString()} workflows) ===`);
			console.log('Creating workflows...');
			const createStart = Date.now();

			const workflows = [];
			const batchSize = 1000;

			// Create workflows in batches
			for (let batch = 0; batch < workflowCount / batchSize; batch++) {
				const batchPromises = [];
				for (let i = 0; i < batchSize; i++) {
					const workflowIndex = batch * batchSize + i;
					batchPromises.push(createWorkflow({ name: `Large Scale Workflow ${workflowIndex}` }));
				}
				const batchWorkflows = await Promise.all(batchPromises);
				workflows.push(...batchWorkflows);

				if (batch % 5 === 0) {
					const progress = ((batch * batchSize) / workflowCount) * 100;
					const elapsed = Date.now() - createStart;
					console.log(
						`  Progress: ${progress.toFixed(1)}% (${(batch * batchSize).toLocaleString()} workflows) - ${(elapsed / 1000).toFixed(1)}s elapsed`,
					);
				}
			}

			const createTime = Date.now() - createStart;
			console.log(
				`✓ Created ${workflowCount.toLocaleString()} workflows in ${(createTime / 1000).toFixed(1)}s`,
			);

			// Share workflows in smaller batches
			console.log('\nSharing workflows...');
			const shareStart = Date.now();
			const sharedWorkflowRepository = Container.get(SharedWorkflowRepository);
			const shareBatchSize = 100;

			for (let i = 0; i < workflows.length; i += shareBatchSize) {
				const batch = workflows.slice(i, i + shareBatchSize);
				await sharedWorkflowRepository.save(
					batch.map((w) => ({
						workflowId: w.id,
						projectId: personalProject.id,
						role: 'workflow:owner',
					})),
				);

				if (i % (shareBatchSize * 50) === 0) {
					const progress = (i / workflows.length) * 100;
					console.log(`  Progress: ${progress.toFixed(1)}%`);
				}
			}

			const shareTime = Date.now() - shareStart;
			console.log(`✓ Shared all workflows in ${(shareTime / 1000).toFixed(1)}s`);

			const roleService = Container.get(RoleService);
			const workflowSharingService = Container.get(WorkflowSharingService);

			const scopes: any = ['workflow:read'];
			const projectRoles = await roleService.rolesWithScope('project', scopes);
			const workflowRoles = await roleService.rolesWithScope('workflow', scopes);

			//
			// BENCHMARK - Old Approach
			//
			console.log('\n=== OLD APPROACH (Pre-fetch IDs) ===');
			const oldStart = Date.now();

			const sharedWorkflowIds = await workflowSharingService.getSharedWorkflowIds(owner, {
				scopes,
				projectId: personalProject.id,
			});
			const oldFetchTime = Date.now() - oldStart;
			console.log(
				`1. Fetched ${sharedWorkflowIds.length.toLocaleString()} workflow IDs in ${oldFetchTime}ms`,
			);

			const oldQueryStart = Date.now();
			const oldResult = await workflowRepository.getManyAndCount(sharedWorkflowIds, {
				filter: { projectId: personalProject.id },
				take: 10,
			});
			const oldQueryTime = Date.now() - oldQueryStart;
			console.log(`2. Queried workflows in ${oldQueryTime}ms`);

			const oldTotalTime = Date.now() - oldStart;
			console.log(`TOTAL: ${oldTotalTime}ms (${oldFetchTime}ms + ${oldQueryTime}ms)`);

			//
			// BENCHMARK - New Approach
			//
			console.log('\n=== NEW APPROACH (Subquery) ===');
			const newStart = Date.now();

			const newResult = await workflowRepository.getManyAndCountWithSharingSubquery(
				owner,
				{
					scopes,
					projectRoles,
					workflowRoles,
				},
				{
					filter: { projectId: personalProject.id },
					take: 10,
				},
			);

			const newTotalTime = Date.now() - newStart;
			console.log(`TOTAL: ${newTotalTime}ms (single query)`);

			//
			// RESULTS
			//
			console.log('\n=== PERFORMANCE COMPARISON ===');
			console.log(`Old approach: ${oldTotalTime}ms`);
			console.log(`New approach: ${newTotalTime}ms`);

			const improvement = oldTotalTime - newTotalTime;
			const improvementPercent = ((improvement / oldTotalTime) * 100).toFixed(1);

			if (improvement > 0) {
				console.log(
					`✓ New approach is ${improvement}ms faster (${improvementPercent}% improvement)`,
				);
			} else {
				console.log(
					`✗ New approach is ${Math.abs(improvement)}ms slower (${Math.abs(
						Number(improvementPercent),
					)}% regression)`,
				);
			}

			//
			// VERIFY
			//
			expect(newResult.count).toBe(oldResult.count);
			expect(newResult.workflows).toHaveLength(oldResult.workflows.length);
			expect(newResult.workflows).toHaveLength(10);
			expect(newResult.count).toBe(workflowCount);
		}, 180000); // 3 minute timeout

		// This test demonstrates the real-world scenario from Linear ticket IAM-159
		// with 130k+ workflows (similar to the customer's 140k workflows)
		it('should benchmark at extreme scale with 130k workflows', async () => {
			//
			// ARRANGE - Create massive dataset
			//
			const { createOwner } = await import('../../shared/db/users');
			const { getPersonalProject } = await import('@n8n/backend-test-utils');
			const { SharedWorkflowRepository } = await import('@n8n/db');
			const { createWorkflow } = await import('@n8n/backend-test-utils');

			const owner = await createOwner();
			const personalProject = await getPersonalProject(owner);

			// Create 130,000 workflows to match real-world scale
			const workflowCount = 130000;
			console.log('\n🚀 EXTREME SCALE BENCHMARK');
			console.log(`Creating ${workflowCount.toLocaleString()} workflows...`);
			console.log(
				'(This simulates the real customer scenario from Linear IAM-159: 130k+ credentials, 140k workflows)',
			);

			const createStart = Date.now();
			const workflows = [];
			const batchSize = 1000;

			// Create workflows in batches for better performance
			for (let batch = 0; batch < workflowCount / batchSize; batch++) {
				const batchPromises = [];
				for (let i = 0; i < batchSize; i++) {
					const workflowIndex = batch * batchSize + i;
					batchPromises.push(createWorkflow({ name: `Extreme Scale Workflow ${workflowIndex}` }));
				}
				const batchWorkflows = await Promise.all(batchPromises);
				workflows.push(...batchWorkflows);

				if (batch % 10 === 0) {
					const progress = ((batch * batchSize) / workflowCount) * 100;
					const elapsed = Date.now() - createStart;
					console.log(
						`  Progress: ${progress.toFixed(1)}% (${(batch * batchSize).toLocaleString()} workflows) - ${(elapsed / 1000).toFixed(1)}s elapsed`,
					);
				}
			}

			const createTime = Date.now() - createStart;
			console.log(
				`✓ Created ${workflowCount.toLocaleString()} workflows in ${(createTime / 1000).toFixed(1)}s`,
			);

			// Share all workflows in smaller batches to avoid expression tree limit
			console.log('\nSharing workflows to project...');
			const shareStart = Date.now();
			const sharedWorkflowRepository = Container.get(SharedWorkflowRepository);
			const shareBatchSize = 100; // Smaller batch size to avoid expression tree limit during INSERT

			for (let i = 0; i < workflows.length; i += shareBatchSize) {
				const batch = workflows.slice(i, i + shareBatchSize);
				await sharedWorkflowRepository.save(
					batch.map((w) => ({
						workflowId: w.id,
						projectId: personalProject.id,
						role: 'workflow:owner',
					})),
				);

				if (i % (shareBatchSize * 100) === 0) {
					const progress = (i / workflows.length) * 100;
					console.log(`  Progress: ${progress.toFixed(1)}%`);
				}
			}

			const shareTime = Date.now() - shareStart;
			console.log(`✓ Shared all workflows in ${(shareTime / 1000).toFixed(1)}s`);

			//
			// BENCHMARK - Old Approach (EXPECTED TO FAIL)
			//
			console.log('\n=== OLD APPROACH (Pre-fetch IDs) ===');
			console.log(
				"NOTE: This approach is expected to FAIL at this scale due to SQLite's expression tree depth limit",
			);

			let oldFailed = false;
			let oldTime = 0;

			try {
				const { WorkflowSharingService } = await import('@/workflows/workflow-sharing.service');
				const workflowSharingService = Container.get(WorkflowSharingService);
				const scopes: any = ['workflow:read'];

				const oldStart = Date.now();
				const sharedWorkflowIds = await workflowSharingService.getSharedWorkflowIds(owner, {
					scopes,
					projectId: personalProject.id,
				});
				console.log(`1. Fetched ${sharedWorkflowIds.length.toLocaleString()} workflow IDs`);

				// This will likely fail with "Expression tree is too large" error
				await workflowRepository.getManyAndCount(sharedWorkflowIds, {
					filter: { projectId: personalProject.id },
					take: 10,
				});

				oldTime = Date.now() - oldStart;
				console.log(`✓ Completed in ${oldTime}ms`);
			} catch (error: any) {
				oldFailed = true;
				console.log(`✗ FAILED as expected: ${error.message}`);
				if (error.message.includes('Expression tree is too large')) {
					console.log(
						'  → This is a known limitation: SQLite expression tree depth limit (max 1000)',
					);
					console.log('  → With 130k workflow IDs in an IN clause, this approach cannot scale');
				}
			}

			//
			// BENCHMARK - New Approach (SHOULD SUCCEED)
			//
			console.log('\n=== NEW APPROACH (Subquery) ===');
			console.log('This approach uses a single subquery and should handle any scale');

			const newStart = Date.now();
			const newResult = await workflowRepository.getManyAndCountWithSharingSubquery(
				owner,
				{
					isPersonalProject: true,
					personalProjectOwnerId: owner.id,
				},
				{
					filter: { projectId: personalProject.id },
					take: 10,
				},
			);
			const newTime = Date.now() - newStart;

			console.log(`✓ Successfully fetched page of workflows in ${newTime}ms`);
			console.log(`✓ Total count: ${newResult.count.toLocaleString()} workflows`);
			console.log(`✓ Returned: ${newResult.workflows.length} workflows (paginated)`);

			//
			// RESULTS
			//
			console.log('\n=== 🏆 EXTREME SCALE RESULTS ===');
			console.log(`Dataset: ${workflowCount.toLocaleString()} workflows`);
			console.log(`Old approach: ${oldFailed ? 'FAILED ✗' : `${oldTime}ms ✓`}`);
			console.log(`New approach: ${newTime}ms ✓`);

			if (oldFailed) {
				console.log(
					'\n✨ KEY FINDING: The new subquery approach handles extreme scale that breaks the old approach!',
				);
				console.log(
					"   The old approach hits SQLite's expression tree limit with large IN clauses.",
				);
				console.log('   The new approach uses a single subquery and works at ANY scale.');
			}

			//
			// VERIFY
			//
			expect(newResult.count).toBe(workflowCount);
			expect(newResult.workflows).toHaveLength(10);
			expect(oldFailed).toBe(true); // Old approach should have failed at this scale
		}, 600000); // 10 minute timeout for extreme scale test
	});
});
