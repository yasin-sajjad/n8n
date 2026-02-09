import { test, expect } from '../../../fixtures/base';

/**
 * CAT-2299: Code node fails with "Task request timed out" when placed after
 * a Wait node in queue mode with an external task runner.
 *
 * Root cause: The runner shuts down during the Wait period (at the exact
 * N8N_RUNNERS_AUTO_SHUTDOWN_TIMEOUT boundary) and is not restarted in time
 * for the next task request during manual execution.
 *
 * Key reproduction conditions (from triage):
 *  - Manual execution (production/trigger executions succeed)
 *  - Wait duration matches AUTO_SHUTDOWN_TIMEOUT exactly (15s)
 *  - Code node before AND after the Wait node
 *  - Queue mode with external task runner
 *
 * @see https://linear.app/n8n/issue/CAT-2299
 * @see https://github.com/n8n-io/n8n/issues/24914
 */
test.use({
	capability: {
		env: {
			N8N_RUNNERS_AUTO_SHUTDOWN_TIMEOUT: '15',
		},
	},
});

test.describe('CAT-2299: Task runner timeout after Wait node', () => {
	// 15s wait + 60s task request timeout + buffer
	test.setTimeout(120_000);

	test('manual execution of code node after 15s wait should not timeout', async ({ n8n }) => {
		await n8n.start.fromImportedWorkflow('CAT-2299-task-runner-timeout-after-wait.json');

		await n8n.canvas.clickExecuteWorkflowButton();

		// The bug causes the Code After Wait node to fail with a task runner timeout
		// after ~75s (15s wait + 60s timeout). Once fixed, replace this block with:
		//   await expect(n8n.canvas.getNodeSuccessStatusIndicator('Code After Wait'))
		//     .toBeVisible({ timeout: 90_000 });
		//   await n8n.notifications.waitForNotificationAndClose('Workflow executed successfully');
		const codeAfterWait = n8n.canvas.nodeByName('Code After Wait');
		await expect(codeAfterWait.getByTestId('node-issues')).toBeVisible({
			timeout: 90_000,
		});
	});
});
