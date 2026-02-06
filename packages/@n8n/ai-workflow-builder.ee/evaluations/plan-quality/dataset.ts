/**
 * Plan Quality Experiment - Dataset
 *
 * Test case definitions and LangSmith dataset seeding.
 * Each case defines a prompt with expected trigger and step keywords.
 */
import { Client } from 'langsmith/client';

// ---------------------------------------------------------------------------
// Test case interface
// ---------------------------------------------------------------------------

export interface PlanTestCase {
	name: string;
	prompt: string;
	/** Expected trigger keywords -- at least one should appear in plan trigger */
	expectedTriggerKeywords: string[];
	/** Expected step keywords -- plan steps should collectively mention these */
	expectedStepKeywords: string[];
}

// ---------------------------------------------------------------------------
// Simple workflows
// ---------------------------------------------------------------------------

const simpleWorkflows: PlanTestCase[] = [
	{
		name: 'Send email on schedule',
		prompt: 'Send a daily email summary to my team every morning at 9am',
		expectedTriggerKeywords: ['schedule', 'cron', 'interval', 'daily', 'time'],
		expectedStepKeywords: ['email', 'send', 'summary'],
	},
	{
		name: 'Webhook to database',
		prompt: 'Receive webhook POST data and insert it into a PostgreSQL table',
		expectedTriggerKeywords: ['webhook'],
		expectedStepKeywords: ['postgres', 'insert', 'data', 'database'],
	},
	{
		name: 'RSS to Slack',
		prompt: 'Monitor an RSS feed and post new items to a Slack channel',
		expectedTriggerKeywords: ['rss', 'schedule', 'poll'],
		expectedStepKeywords: ['slack', 'post', 'message', 'item'],
	},
	{
		name: 'Form to spreadsheet',
		prompt: 'When someone submits a form, save the response to Google Sheets',
		expectedTriggerKeywords: ['form', 'webhook', 'trigger'],
		expectedStepKeywords: ['google sheets', 'sheet', 'save', 'row', 'append'],
	},
	{
		name: 'Slack command response',
		prompt: 'Reply to Slack messages that mention our bot with a helpful response',
		expectedTriggerKeywords: ['slack', 'trigger', 'event'],
		expectedStepKeywords: ['message', 'reply', 'respond'],
	},
];

// ---------------------------------------------------------------------------
// Medium complexity workflows
// ---------------------------------------------------------------------------

const mediumWorkflows: PlanTestCase[] = [
	{
		name: 'Invoice processing',
		prompt: 'Automatically process invoices from email and update accounting in QuickBooks',
		expectedTriggerKeywords: ['email', 'gmail', 'imap', 'schedule'],
		expectedStepKeywords: ['invoice', 'extract', 'quickbooks', 'accounting', 'data'],
	},
	{
		name: 'Lead scoring',
		prompt: 'Score incoming leads from HubSpot based on their activity and update the CRM',
		expectedTriggerKeywords: ['hubspot', 'webhook', 'trigger', 'schedule'],
		expectedStepKeywords: ['lead', 'score', 'update', 'activity', 'crm'],
	},
	{
		name: 'Content pipeline',
		prompt: 'Collect blog post drafts from Google Docs, format them, and publish to WordPress',
		expectedTriggerKeywords: ['schedule', 'google', 'manual'],
		expectedStepKeywords: ['google docs', 'format', 'wordpress', 'publish', 'blog'],
	},
	{
		name: 'Customer onboarding',
		prompt:
			'When a new customer signs up in Stripe, send a welcome email and create a Slack channel',
		expectedTriggerKeywords: ['stripe', 'webhook', 'trigger'],
		expectedStepKeywords: ['welcome', 'email', 'slack', 'channel', 'create'],
	},
	{
		name: 'Expense approval',
		prompt:
			'Set up an approval workflow where expense reports submitted via form are sent to a manager on Slack for approval, then logged in Google Sheets',
		expectedTriggerKeywords: ['form', 'webhook', 'trigger'],
		expectedStepKeywords: ['expense', 'approval', 'approve', 'slack', 'google sheets', 'sheet'],
	},
];

// ---------------------------------------------------------------------------
// Complex workflows (multi-step, AI, monitoring)
// ---------------------------------------------------------------------------

const complexWorkflows: PlanTestCase[] = [
	{
		name: 'AI customer support',
		prompt:
			'Build an AI-powered customer support workflow that reads support tickets from Zendesk, uses AI to draft responses, and sends them for human review via Slack',
		expectedTriggerKeywords: ['zendesk', 'schedule', 'webhook', 'trigger', 'poll'],
		expectedStepKeywords: ['ticket', 'ai', 'draft', 'response', 'slack', 'review'],
	},
	{
		name: 'Monitoring and alerting',
		prompt:
			'Monitor an API endpoint every 5 minutes, check if the response time exceeds 2 seconds, and alert the team on PagerDuty and Slack',
		expectedTriggerKeywords: ['schedule', 'cron', 'interval', 'every'],
		expectedStepKeywords: ['http', 'api', 'response', 'check', 'alert', 'pagerduty', 'slack'],
	},
	{
		name: 'Data sync between services',
		prompt:
			'Sync contacts between Salesforce and Mailchimp bidirectionally, running every hour and handling duplicates',
		expectedTriggerKeywords: ['schedule', 'cron', 'interval', 'hour'],
		expectedStepKeywords: ['salesforce', 'mailchimp', 'contact', 'sync', 'duplicate'],
	},
	{
		name: 'AI content generation pipeline',
		prompt:
			'Generate weekly social media posts using AI based on trending topics, create images with DALL-E, and schedule posts to Buffer',
		expectedTriggerKeywords: ['schedule', 'cron', 'weekly', 'manual'],
		expectedStepKeywords: ['ai', 'social', 'post', 'image', 'generate', 'schedule'],
	},
	{
		name: 'Multi-channel notification system',
		prompt:
			'When a critical error is logged in a webhook, classify the severity with AI, and route notifications to Slack for low severity, email for medium, and PagerDuty for high severity',
		expectedTriggerKeywords: ['webhook'],
		expectedStepKeywords: ['error', 'severity', 'classify', 'slack', 'email', 'pagerduty', 'route'],
	},
];

// ---------------------------------------------------------------------------
// All test cases
// ---------------------------------------------------------------------------

export const ALL_TEST_CASES: PlanTestCase[] = [
	...simpleWorkflows,
	...mediumWorkflows,
	...complexWorkflows,
];

// ---------------------------------------------------------------------------
// Dataset seeding
// ---------------------------------------------------------------------------

/**
 * Seed (or update) a LangSmith dataset with the built-in test cases.
 */
export async function seedDataset(client: Client, datasetName: string): Promise<void> {
	// Create or get existing dataset
	let dataset: { id: string };
	try {
		dataset = await client.readDataset({ datasetName });
		console.log(
			`Dataset "${datasetName}" already exists (id=${dataset.id}), upserting examples...`,
		);
	} catch {
		dataset = await client.createDataset(datasetName, {
			description: 'Plan quality evaluation dataset for discovery + planner subgraph',
		});
		console.log(`Created dataset "${datasetName}" (id=${dataset.id})`);
	}

	// Delete existing examples to avoid duplicates
	const existingExamples: Array<{ id: string }> = [];
	for await (const example of client.listExamples({ datasetId: dataset.id })) {
		existingExamples.push(example);
	}

	if (existingExamples.length > 0) {
		console.log(`Deleting ${existingExamples.length} existing examples...`);
		await client.deleteExamples(existingExamples.map((e) => e.id));
	}

	// Create examples from test cases
	const inputs = ALL_TEST_CASES.map((tc) => ({
		prompt: tc.prompt,
		expectedTriggerKeywords: tc.expectedTriggerKeywords,
		expectedStepKeywords: tc.expectedStepKeywords,
	}));

	const outputs = ALL_TEST_CASES.map((tc) => ({
		name: tc.name,
	}));

	await client.createExamples({
		inputs,
		outputs,
		datasetId: dataset.id,
	});

	console.log(`Seeded ${ALL_TEST_CASES.length} examples into dataset "${datasetName}"`);
}
