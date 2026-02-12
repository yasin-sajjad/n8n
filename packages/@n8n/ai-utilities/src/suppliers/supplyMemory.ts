import type { ISupplyDataFunctions, SupplyData } from 'n8n-workflow';

import { LangchainMemoryAdapter } from '../adapters/langchain-memory';
import type { ChatMemoryOptions } from '../types/creators';
import type { ChatMemory } from '../types/memory';
import { logWrapper } from '../utils/log-wrapper';

export function supplyMemory(
	context: ISupplyDataFunctions,
	memory: ChatMemory,
	options?: ChatMemoryOptions,
): SupplyData {
	const adapter = new LangchainMemoryAdapter(memory);
	const wrappedAdapter = logWrapper(adapter, context);

	return {
		response: wrappedAdapter,
		closeFunction: options?.closeFunction,
	};
}
