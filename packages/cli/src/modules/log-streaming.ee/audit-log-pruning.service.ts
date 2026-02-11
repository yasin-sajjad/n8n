import { Logger } from '@n8n/backend-common';
import { Time } from '@n8n/constants';
import { OnLeaderStepdown, OnLeaderTakeover } from '@n8n/decorators';
import { Service } from '@n8n/di';
import { LessThan } from '@n8n/typeorm';
import { strict } from 'assert';
import { InstanceSettings } from 'n8n-core';

import { AuditLogRepository } from './database/repositories/audit-log.repository';

const MAX_AGE_DAYS = 5;
const MAX_ROWS = 10_000;
const PRUNE_INTERVAL_MS = Time.hours.toMilliseconds;
const DELAY_ON_ERROR_MS = Time.seconds.toMilliseconds;

@Service()
export class AuditLogPruningService {
	private pruneTimeout: NodeJS.Timeout | undefined;

	private isStopped = true;

	constructor(
		private readonly auditLogRepository: AuditLogRepository,
		private readonly instanceSettings: InstanceSettings,
		private readonly logger: Logger,
	) {
		this.logger = this.logger.scoped('pruning');
	}

	init() {
		if (this.instanceSettings.isLeader) {
			this.startPruningTimer();
		}
	}

	shutdown() {
		this.stopPruningTimer();
	}

	@OnLeaderTakeover()
	startPruningTimer() {
		strict(this.isStopped);
		this.clearPruningTimer();
		this.isStopped = false;
		this.scheduleNextPrune();
		this.logger.debug('Started audit log pruning timer');
	}

	@OnLeaderStepdown()
	stopPruningTimer() {
		this.isStopped = true;
		this.clearPruningTimer();
		this.logger.debug('Stopped audit log pruning timer');
	}

	async pruneAuditLogs() {
		this.logger.info('Pruning audit log data');
		try {
			// 1. Delete rows older than MAX_AGE_DAYS
			const cutoffDate = new Date(Date.now() - MAX_AGE_DAYS * Time.days.toMilliseconds);
			const ageResult = await this.auditLogRepository.delete({
				timestamp: LessThan(cutoffDate),
			});
			this.logger.debug(
				'Deleted old audit log entries',
				ageResult.affected ? { count: ageResult.affected } : {},
			);

			// 2. Cap at MAX_ROWS by deleting oldest entries beyond the limit
			const totalCount = await this.auditLogRepository.count();
			if (totalCount > MAX_ROWS) {
				const excessCount = totalCount - MAX_ROWS;
				const deletedCount = await this.auditLogRepository.deleteOldestInBatches(excessCount);
				this.logger.debug('Deleted excess audit log entries', { count: deletedCount });
			}

			this.scheduleNextPrune();
		} catch (error: unknown) {
			this.logger.warn('Audit log pruning failed', { error });
			this.scheduleNextPrune(DELAY_ON_ERROR_MS);
		}
	}

	private scheduleNextPrune(delayMs = PRUNE_INTERVAL_MS) {
		if (this.isStopped) return;

		this.pruneTimeout = setTimeout(async () => {
			await this.pruneAuditLogs();
		}, delayMs);
	}

	private clearPruningTimer() {
		if (this.pruneTimeout !== undefined) {
			clearTimeout(this.pruneTimeout);
			this.pruneTimeout = undefined;
		}
	}
}
