import type { DynamicStructuredTool, Tool } from '@langchain/classic/tools';

export interface SkillData {
	name: string;
	description: string;
	instructions: string;
	tools: Array<DynamicStructuredTool | Tool>;
	/** Called when the agent activates this skill to record execution data (green border). */
	recordExecution?: () => void;
}
