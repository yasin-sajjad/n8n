import type { INodeTypeDescription, ISupplyDataFunctions, NodeMethods } from 'n8n-workflow';

import type { ChatModel } from './chat-model';
import type { ChatMemory } from './memory';
import type { OpenAIModelOptions } from './openai';

interface AiNode {
	description: INodeTypeDescription;
	methods?: NodeMethods;
}

export type OpenAiModel = OpenAIModelOptions & {
	type: 'openai';
};
export type ChatModelOptions = ChatModel | OpenAiModel;
export type GetChatModelFn = (
	context: ISupplyDataFunctions,
	itemIndex: number,
) => Promise<ChatModelOptions>;

export interface ChatModelNodeConfig extends AiNode {
	model: GetChatModelFn | ChatModelOptions;
}

export interface ChatMemoryOptions {
	closeFunction?: () => Promise<void>;
}
export type GetChatMemoryFn = (
	context: ISupplyDataFunctions,
	itemIndex: number,
) => Promise<ChatMemory>;
export interface ChatMemoryNodeConfig extends AiNode {
	memory: GetChatMemoryFn;
	memoryOptions?: ChatMemoryOptions;
}

interface UndextendableNode {
	description: never;
	methods: never;
	supplyData: never;
	execute: never;
}

// This class is never used as a real class, only as a type
// Trying to extend supplyData, methods or description will result in a type error
class UnextendableNodeClass implements UndextendableNode {
	description = null as never;
	methods = null as never;
	supplyData = null as never;
	execute = null as never;
}

export type UnextendableNodeType = typeof UnextendableNodeClass;
