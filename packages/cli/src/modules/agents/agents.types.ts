export interface LlmMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface TaskStep {
	action: string;
	workflowName?: string;
	toAgent?: string;
	result?: string;
}

export interface TaskResult {
	status: string;
	summary?: string;
	steps: TaskStep[];
	message?: string;
}
