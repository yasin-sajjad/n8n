import type { ModuleInterface } from '@n8n/decorators';
import { BackendModule, OnShutdown } from '@n8n/decorators';

@BackendModule({ name: 'agents' })
export class AgentsModule implements ModuleInterface {
	async init() {
		await import('./agents.controller');
	}

	@OnShutdown()
	async shutdown() {}
}
