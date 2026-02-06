/**
 * Question Quality Experiment - Dataset
 *
 * Test case definitions and LangSmith dataset seeding.
 * Cases are imported from the integration test for consistency.
 */
import { Client } from 'langsmith/client';

// ---------------------------------------------------------------------------
// Test case interface
// ---------------------------------------------------------------------------

export interface QuestionTestCase {
	name: string;
	prompt: string;
	/** Whether we expect the agent to ask clarifying questions */
	expectQuestions: boolean;
	/** Category: should_ask, should_not_ask, or grey_zone */
	category: 'should_ask' | 'should_not_ask' | 'grey_zone';
	/**
	 * Keywords that should appear in at least one question text or option.
	 * Only checked when expectQuestions=true and questions are actually asked.
	 */
	relevantKeywords: string[];
}

// ---------------------------------------------------------------------------
// SHOULD ASK: genuinely ambiguous, could mean 3+ different workflows
// ---------------------------------------------------------------------------

const shouldAskPrompts: QuestionTestCase[] = [
	{
		name: 'Ambiguous: "do something with emails"',
		prompt: 'Do something with my emails',
		expectQuestions: true,
		category: 'should_ask',
		relevantKeywords: ['email', 'gmail', 'outlook'],
	},
	{
		name: 'Ambiguous: notifications, no channel or trigger',
		prompt: 'Set up notifications for my team',
		expectQuestions: true,
		category: 'should_ask',
		relevantKeywords: ['slack', 'email', 'telegram', 'notification'],
	},
	{
		name: 'Ambiguous: "automate my CRM" -- which CRM? what action?',
		prompt: 'Automate my CRM',
		expectQuestions: true,
		category: 'should_ask',
		relevantKeywords: ['salesforce', 'hubspot', 'pipedrive', 'crm', 'lead', 'contact'],
	},
	{
		name: 'Ambiguous: data sync with no services named',
		prompt: 'Sync my data between services',
		expectQuestions: true,
		category: 'should_ask',
		relevantKeywords: ['sync', 'service'],
	},
	{
		name: 'Ambiguous: "build a chatbot" -- for what? where?',
		prompt: 'Build a chatbot',
		expectQuestions: true,
		category: 'should_ask',
		relevantKeywords: ['slack', 'telegram', 'chat', 'knowledge', 'ai'],
	},
];

// ---------------------------------------------------------------------------
// SHOULD NOT ASK: clear intent, reasonable defaults, one obvious workflow
// ---------------------------------------------------------------------------

const shouldNotAskPrompts: QuestionTestCase[] = [
	{
		name: 'Clear: website monitoring with defaults',
		prompt: 'Monitor my website for downtime and alert me',
		expectQuestions: false,
		category: 'should_not_ask',
		relevantKeywords: [],
	},
	{
		name: 'Clear: weather check and store',
		prompt: 'Check weather every hour and store the data',
		expectQuestions: false,
		category: 'should_not_ask',
		relevantKeywords: [],
	},
	{
		name: 'Clear: Slack + Gmail with specific trigger',
		prompt: 'Send a Slack message when I get a Gmail with an invoice attachment',
		expectQuestions: false,
		category: 'should_not_ask',
		relevantKeywords: [],
	},
	{
		name: 'Clear: RSS digest with all details',
		prompt:
			'Every Monday at 8am, collect new RSS items from TechCrunch and send me a digest via Gmail',
		expectQuestions: false,
		category: 'should_not_ask',
		relevantKeywords: [],
	},
	{
		name: 'Clear: webhook to database',
		prompt: 'Receive webhook POST data and insert it into a PostgreSQL table',
		expectQuestions: false,
		category: 'should_not_ask',
		relevantKeywords: [],
	},
];

// ---------------------------------------------------------------------------
// GREY ZONE: intent is clear-ish but missing a key detail
// ---------------------------------------------------------------------------

const greyZonePrompts: QuestionTestCase[] = [
	{
		name: 'Grey: lead scoring -- clear domain, vague mechanics',
		prompt: 'Create a lead scoring workflow',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['lead', 'score', 'crm', 'hubspot', 'salesforce', 'form'],
	},
	{
		name: 'Grey: competitor pricing -- clear goal, missing target',
		prompt: 'Scrape competitor pricing daily and track changes',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['competitor', 'site', 'url', 'price', 'store', 'sheet'],
	},
	{
		name: 'Grey: approval workflow -- clear pattern, vague scope',
		prompt: 'Set up an approval workflow for expense reports',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['expense', 'approval', 'approve', 'slack', 'email', 'form'],
	},
	{
		name: 'Grey: contact form to newsletter -- almost specific',
		prompt: 'When someone fills out my contact form, add them to my newsletter',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['newsletter', 'mailchimp', 'sendgrid', 'brevo', 'form'],
	},
	{
		name: 'Grey: daily Slack summary -- clear but missing scope',
		prompt: 'Send me a daily summary of my Slack messages',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['slack', 'channel', 'summary', 'message'],
	},
	{
		name: 'Grey: onboarding automation -- domain clear, steps vague',
		prompt: 'Automate new employee onboarding',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['onboard', 'employee', 'welcome', 'account', 'slack', 'email'],
	},
	{
		name: 'Grey: invoice processing -- clear task, vague source',
		prompt: 'Automatically process invoices and update accounting',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['invoice', 'accounting', 'quickbooks', 'xero', 'gmail', 'extract'],
	},
	{
		name: 'Grey: social listening -- clear category, multiple approaches',
		prompt: 'Track mentions of my brand across the internet',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['brand', 'mention', 'social', 'monitor', 'alert', 'twitter'],
	},
	{
		name: 'Grey: backup workflow -- clear need, vague target',
		prompt: 'Back up my important data regularly',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['backup', 'google drive', 'dropbox', 's3', 'sheet', 'database'],
	},
	{
		name: 'Grey: AI content -- clear use of AI, unclear specifics',
		prompt: 'Use AI to help with my content creation',
		expectQuestions: true,
		category: 'grey_zone',
		relevantKeywords: ['content', 'blog', 'social', 'article', 'post', 'ai'],
	},
];

// ---------------------------------------------------------------------------
// All test cases
// ---------------------------------------------------------------------------

export const ALL_TEST_CASES: QuestionTestCase[] = [
	...shouldAskPrompts,
	...shouldNotAskPrompts,
	...greyZonePrompts,
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
			description: 'Question quality evaluation dataset for discovery subgraph',
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
		category: tc.category,
		relevantKeywords: tc.relevantKeywords,
	}));

	const outputs = ALL_TEST_CASES.map((tc) => ({
		expectQuestions: tc.expectQuestions,
		name: tc.name,
	}));

	await client.createExamples({
		inputs,
		outputs,
		datasetId: dataset.id,
	});

	console.log(`Seeded ${ALL_TEST_CASES.length} examples into dataset "${datasetName}"`);
}
