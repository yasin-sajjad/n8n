import type { AuditLogEvent, AuditLogFilterDto } from '@n8n/api-types';

import type { IRestApiContext } from '../types';
import { makeRestApiRequest } from '../utils';

export async function getAuditLogs(
	context: IRestApiContext,
	filters?: AuditLogFilterDto,
): Promise<AuditLogEvent[]> {
	const params: Record<string, string> = {};
	if (filters?.eventName) params.eventName = filters.eventName;
	if (filters?.userId) params.userId = filters.userId;
	if (filters?.after) params.after = filters.after;
	if (filters?.before) params.before = filters.before;

	return await makeRestApiRequest(
		context,
		'GET',
		'/audit-log/events',
		Object.keys(params).length > 0 ? params : undefined,
	);
}
