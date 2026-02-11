import { CreateAgentDto, UpdateAgentDto } from '@n8n/api-types';
import type { AuthenticatedRequest } from '@n8n/db';
import { RestController, Body, Get, Post, Patch, Param } from '@n8n/decorators';
import type { Response } from 'express';

import { AgentsService } from './agents.service';

@RestController('/agents')
export class AgentsController {
	constructor(private readonly agentsService: AgentsService) {}

	@Post('/')
	async createAgent(_req: AuthenticatedRequest, _res: Response, @Body payload: CreateAgentDto) {
		return await this.agentsService.createAgent(payload);
	}

	@Patch('/:agentId')
	async updateAgent(
		_req: AuthenticatedRequest,
		_res: Response,
		@Param('agentId') agentId: string,
		@Body payload: UpdateAgentDto,
	) {
		return await this.agentsService.updateAgent(agentId, payload);
	}

	@Get('/:agentId/capabilities')
	async getCapabilities(
		_req: AuthenticatedRequest,
		_res: Response,
		@Param('agentId') agentId: string,
	) {
		return await this.agentsService.getCapabilities(agentId);
	}

	@Post('/:agentId/task')
	async dispatchTask(req: AuthenticatedRequest, _res: Response, @Param('agentId') agentId: string) {
		const { prompt } = req.body as { prompt: string };
		return await this.agentsService.executeTask(agentId, prompt, 0);
	}
}
