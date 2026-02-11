import { z } from 'zod';

import { Z } from '../../zod-class';

export class AiGenerateVersionDescriptionRequestDto extends Z.class({
	workflowName: z.string(),
	currentVersion: z.object({
		nodes: z.array(z.object({}).passthrough()),
		connections: z.record(z.unknown()),
	}),
	previousVersion: z
		.object({
			nodes: z.array(z.object({}).passthrough()),
			connections: z.record(z.unknown()),
		})
		.optional(),
}) {}
