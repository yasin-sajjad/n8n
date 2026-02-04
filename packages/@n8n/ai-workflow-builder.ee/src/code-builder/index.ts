/**
 * Code Builder Module
 *
 * Public API for the code builder agent and related utilities.
 */

// Constants
export {
	MAX_AGENT_ITERATIONS,
	MAX_VALIDATE_ATTEMPTS,
	FIX_AND_FINALIZE_INSTRUCTION,
	TEXT_EDITOR_TOOL,
	VALIDATE_TOOL,
	SONNET_4_5_PRICING,
} from './constants';

// Types
export type {
	WorkflowCodeOutput,
	ParseAndValidateResult,
	ValidationWarning,
	CodeBuilderAgentConfig,
} from './types';

// Utilities
export { calculateCost } from './utils/cost-calculator';
export { extractTextContent, extractThinkingContent } from './utils/content-extractors';

// State management
export { ChatState } from './state/chat-state';
export { WarningTracker } from './state/warning-tracker';

// Handlers
export { ParseValidateHandler } from './handlers/parse-validate-handler';
export type {
	ParseValidateHandlerConfig,
	ValidationFeedbackResult,
	ParseErrorResult,
} from './handlers/parse-validate-handler';
