/**
 * Question Quality Experiment - Evaluators
 *
 * All metric evaluation functions for question quality assessment.
 * Each evaluator takes the raw target output and returns a metric value.
 */
import type { BaseMessage } from '@langchain/core/messages';
import { isAIMessage } from '@langchain/core/messages';

// ---------------------------------------------------------------------------
// Question data type (matches interrupt schema)
// ---------------------------------------------------------------------------

export interface QuestionData {
	id: string;
	question: string;
	type: string;
	options?: string[];
}

// ---------------------------------------------------------------------------
// Jargon and generic options blocklists
// ---------------------------------------------------------------------------

const JARGON_TERMS = [
	'n8n-nodes-base',
	'@n8n/',
	'node type',
	'webhook mode',
	'execution mode',
	'binary data',
	'expression',
	'trigger type',
	'what format',
	'error handling',
	'connection type',
	'parameter',
	'which version',
	'api endpoint',
	'authentication method',
	'oauth',
	'http request',
	'json',
	'webhook',
	'cron',
	'regex',
	'polling interval',
];

const GENERIC_OPTIONS = ['yes', 'no', 'maybe', 'not sure', 'none', 'n/a'];

// ---------------------------------------------------------------------------
// Storage-related keywords for data_table_first check
// ---------------------------------------------------------------------------

const STORAGE_KEYWORDS = [
	'store',
	'save',
	'database',
	'table',
	'sheet',
	'storage',
	'record',
	'track',
	'log',
	'backup',
	'back up',
];

// ---------------------------------------------------------------------------
// Yes/no question prefixes
// ---------------------------------------------------------------------------

const YES_NO_PREFIXES = ['do you want', 'would you like', 'should i'];

// ---------------------------------------------------------------------------
// Metric computation
// ---------------------------------------------------------------------------

export interface MetricsInput {
	askedQuestions: boolean;
	questions: QuestionData[];
	introMessage?: string;
	messages: BaseMessage[];
	category: string;
	prompt: string;
	relevantKeywords: string[];
}

export interface ComputedMetrics {
	asked_questions: boolean;
	question_count: number;
	keyword_hit: boolean;
	no_other_option: boolean;
	no_jargon: boolean;
	has_options: boolean;
	no_duplicate_options: boolean;
	no_yes_no: boolean;
	options_are_specific: boolean;
	intro_message_length: number;
	node_searches_before_questions: number;
	data_table_first: boolean;
}

/**
 * Compute all quality metrics from the raw target output.
 */
export function computeMetrics(input: MetricsInput): ComputedMetrics {
	const { askedQuestions, questions, introMessage, messages, category, prompt, relevantKeywords } =
		input;

	return {
		asked_questions: askedQuestions,
		question_count: questions.length,
		keyword_hit: computeKeywordHit(questions, relevantKeywords),
		no_other_option: computeNoOtherOption(questions),
		no_jargon: computeNoJargon(questions),
		has_options: computeHasOptions(questions),
		no_duplicate_options: computeNoDuplicateOptions(questions),
		no_yes_no: computeNoYesNo(questions),
		options_are_specific: computeOptionsAreSpecific(questions),
		intro_message_length: introMessage?.length ?? 0,
		node_searches_before_questions: countNodeSearches(messages),
		data_table_first: computeDataTableFirst(questions, category, prompt),
	};
}

// ---------------------------------------------------------------------------
// Individual metric functions
// ---------------------------------------------------------------------------

/**
 * At least one keyword from relevantKeywords found in question text or options.
 */
function computeKeywordHit(questions: QuestionData[], relevantKeywords: string[]): boolean {
	if (relevantKeywords.length === 0) return true;
	if (questions.length === 0) return false;

	const allText = questions
		.flatMap((q) => [q.question, ...(q.options ?? [])])
		.join(' ')
		.toLowerCase();

	return relevantKeywords.some((kw) => allText.includes(kw.toLowerCase()));
}

/**
 * No option starts with "other" (case-insensitive).
 */
function computeNoOtherOption(questions: QuestionData[]): boolean {
	for (const q of questions) {
		if (q.options) {
			for (const opt of q.options) {
				if (opt.toLowerCase().trim().startsWith('other')) {
					return false;
				}
			}
		}
	}
	return true;
}

/**
 * No blocklist terms in questions or options.
 */
function computeNoJargon(questions: QuestionData[]): boolean {
	for (const q of questions) {
		const textsToCheck = [q.question, ...(q.options ?? [])];
		for (const text of textsToCheck) {
			const lower = text.toLowerCase();
			for (const term of JARGON_TERMS) {
				if (lower.includes(term.toLowerCase())) {
					return false;
				}
			}
		}
	}
	return true;
}

/**
 * All single/multi questions have options array with length > 0.
 */
function computeHasOptions(questions: QuestionData[]): boolean {
	for (const q of questions) {
		if ((q.type === 'single' || q.type === 'multi') && (!q.options || q.options.length === 0)) {
			return false;
		}
	}
	return true;
}

/**
 * No two options identical (case-insensitive) per question.
 */
function computeNoDuplicateOptions(questions: QuestionData[]): boolean {
	for (const q of questions) {
		if (q.options) {
			const seen = new Set<string>();
			for (const opt of q.options) {
				const normalized = opt.toLowerCase().trim();
				if (seen.has(normalized)) {
					return false;
				}
				seen.add(normalized);
			}
		}
	}
	return true;
}

/**
 * No questions starting with "Do you want", "Would you like", "Should I".
 */
function computeNoYesNo(questions: QuestionData[]): boolean {
	for (const q of questions) {
		const lower = q.question.toLowerCase();
		for (const prefix of YES_NO_PREFIXES) {
			if (lower.startsWith(prefix)) {
				return false;
			}
		}
	}
	return true;
}

/**
 * No options that are just "Yes", "No", "Maybe", "Not sure", "None", "N/A".
 */
function computeOptionsAreSpecific(questions: QuestionData[]): boolean {
	for (const q of questions) {
		if (q.options) {
			for (const opt of q.options) {
				if (GENERIC_OPTIONS.includes(opt.toLowerCase().trim())) {
					return false;
				}
			}
		}
	}
	return true;
}

/**
 * Count AIMessages with tool_calls containing search_nodes.
 */
function countNodeSearches(messages: BaseMessage[]): number {
	let count = 0;
	for (const msg of messages) {
		if (isAIMessage(msg) && msg.tool_calls) {
			for (const tc of msg.tool_calls) {
				if (tc.name === 'search_nodes') {
					count++;
				}
			}
		}
	}
	return count;
}

/**
 * For storage-related prompts: first option mentions "data table" or "built-in".
 * For non-storage prompts, always true.
 */
function computeDataTableFirst(
	questions: QuestionData[],
	category: string,
	prompt: string,
): boolean {
	const promptLower = prompt.toLowerCase();
	const isStorageRelated = STORAGE_KEYWORDS.some((kw) => promptLower.includes(kw));

	if (!isStorageRelated) return true;
	if (questions.length === 0) return true;

	// Find storage-related question
	const storageQuestion = questions.find((q) => {
		const text = q.question.toLowerCase();
		const optionsText = (q.options ?? []).join(' ').toLowerCase();
		const allText = `${text} ${optionsText}`;
		return STORAGE_KEYWORDS.some((kw) => allText.includes(kw));
	});

	if (!storageQuestion || !storageQuestion.options || storageQuestion.options.length === 0) {
		// No storage question or no options -- acceptable (agent may have defaulted)
		return true;
	}

	const firstOption = storageQuestion.options[0].toLowerCase();
	return firstOption.includes('data table') || firstOption.includes('built-in');
}

// ---------------------------------------------------------------------------
// Convert metrics to LangSmith feedback format
// ---------------------------------------------------------------------------

export interface FeedbackEntry {
	key: string;
	score: number;
	comment?: string;
}

/**
 * Convert ComputedMetrics to an array of LangSmith feedback entries.
 * Booleans become 0/1, numbers pass through as-is.
 */
export function metricsToFeedback(metrics: ComputedMetrics): FeedbackEntry[] {
	return Object.entries(metrics).map(([key, value]) => ({
		key,
		score: typeof value === 'boolean' ? (value ? 1 : 0) : value,
	}));
}
