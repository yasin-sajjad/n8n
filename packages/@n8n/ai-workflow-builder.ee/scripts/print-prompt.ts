#!/usr/bin/env tsx

/**
 * Print Code Builder Agent Prompt
 *
 * Outputs the full system prompt for the code builder agent to a markdown file.
 * Run with: pnpm print:prompt
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

import { buildCodeBuilderPrompt } from '../src/code-builder/prompts';

/**
 * Unescape curly brackets from LangChain template format
 */
function unescapeCurlyBrackets(text: string): string {
	return text.replace(/\{\{/g, '{').replace(/\}\}/g, '}');
}

interface ContentBlock {
	type: string;
	text: string;
}

interface DictPromptTemplate {
	template: ContentBlock | string;
}

interface PromptMessage {
	prompt: DictPromptTemplate[];
}

const prompt = buildCodeBuilderPrompt();
const messages = prompt.promptMessages as unknown as PromptMessage[];

let output = '# Code Builder Agent Prompt\n\n';

// Extract system message - prompt[0].template is { type: 'text', text: '...' }
const systemMessage = messages[0];
const systemTemplate = systemMessage.prompt?.[0]?.template;
const systemText = typeof systemTemplate === 'string' ? systemTemplate : systemTemplate?.text;
if (systemText) {
	output += unescapeCurlyBrackets(systemText);
	output += '\n\n';
}

// Extract human message template
const humanMessage = messages[1];
if (humanMessage.prompt?.[0]?.template) {
	const template =
		typeof humanMessage.prompt[0].template === 'string'
			? humanMessage.prompt[0].template
			: (humanMessage.prompt[0].template.text ?? '');
	if (template) {
		output += '---\n\n## USER MESSAGE\n\n';
		output += unescapeCurlyBrackets(template);
		output += '\n';
	}
}

const outputPath = join(__dirname, 'code-builder-prompt.md');
writeFileSync(outputPath, output);

console.log(`Prompt written to: ${outputPath}`);
