import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { getConnectedTools } from '@utils/helpers';
import { getConnectionHintNoticeField } from '@utils/sharedFields';

import type { SkillData } from '../types';

export class SkillInline implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AI Skill',
		name: 'skillInline',
		icon: 'fa:graduation-cap',
		iconColor: 'black',
		group: ['transform'],
		version: [1],
		description: 'Bundle instructions and tools into a skill that the AI agent activates on demand',
		defaults: {
			name: 'AI Skill',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Skills'],
			},
		},
		inputs: [
			{
				type: NodeConnectionTypes.AiTool,
				displayName: 'Tool',
			},
		],
		outputs: [NodeConnectionTypes.AiSkill],
		outputNames: ['Skill'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiAgent]),
			{
				displayName: 'Skill Name',
				name: 'skillName',
				type: 'string',
				default: '',
				placeholder: 'e.g. Data Analysis',
				description: 'Short name for the skill — shown to the agent before activation',
				required: true,
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				placeholder: 'e.g. Analyze data sets, generate charts, and provide insights',
				description:
					'Brief description of what this skill does — the agent sees this before deciding to activate',
			},
			{
				displayName: 'Instructions',
				name: 'instructions',
				type: 'string',
				default: '',
				placeholder: 'Enter the full instructions the agent receives when it activates this skill',
				description: 'Full instructions loaded only when the agent activates this skill',
				typeOptions: {
					rows: 8,
				},
				required: true,
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const skillName = this.getNodeParameter('skillName', itemIndex) as string;
		const description = this.getNodeParameter('description', itemIndex) as string;
		const instructions = this.getNodeParameter('instructions', itemIndex) as string;

		const tools = await getConnectedTools(this, false, false);

		// Capture context so we can record execution data later when the skill is activated
		const ctx = this;
		const skillData: SkillData = {
			name: skillName,
			description,
			instructions,
			tools,
			recordExecution: () => {
				const { index } = ctx.addInputData(NodeConnectionTypes.AiSkill, [
					[{ json: { skillName, description } }],
				]);
				ctx.addOutputData(NodeConnectionTypes.AiSkill, index, [
					[{ json: { skillName, description, instructions, toolCount: tools.length } }],
				]);
			},
		};

		return {
			response: skillData,
		};
	}
}
