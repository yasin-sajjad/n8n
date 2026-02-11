import { z } from 'zod';

import { Z } from '../../zod-class';

export const auditLogEvent = z.object({
	id: z.string(),
	eventName: z.string(),
	timestamp: z.date(),
	userId: z.string().nullish(),
	user: z
		.object({
			id: z.string(),
			email: z.string(),
			firstName: z.string().nullable(),
			lastName: z.string().nullable(),
		})
		.nullish(),
	payload: z.record(z.string(), z.unknown()).nullable(),
});

export type AuditLogEvent = z.infer<typeof auditLogEvent>;

export class AuditLogFilterDto extends Z.class({
	eventName: z.string().optional(),
	userId: z.string().optional(),
	after: z.string().datetime().optional(),
	before: z.string().datetime().optional(),
}) {}
