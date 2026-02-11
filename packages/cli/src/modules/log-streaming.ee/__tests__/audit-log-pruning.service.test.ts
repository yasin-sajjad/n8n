import { mockLogger } from '@n8n/backend-test-utils';
import { Time } from '@n8n/constants';
import { mock } from 'jest-mock-extended';
import type { InstanceSettings } from 'n8n-core';

import type { AuditLogRepository } from '../database/repositories/audit-log.repository';
import { AuditLogPruningService } from '../audit-log-pruning.service';

const mockInstanceSettings = mock<InstanceSettings>({ isLeader: true });

describe('AuditLogPruningService', () => {
	let auditLogRepository: AuditLogRepository;
	let service: AuditLogPruningService;

	beforeAll(() => {
		auditLogRepository = mock<AuditLogRepository>();
		service = new AuditLogPruningService(auditLogRepository, mockInstanceSettings, mockLogger());
	});

	describe('pruning scheduling', () => {
		beforeEach(() => {
			jest.useFakeTimers();
		});

		afterEach(() => {
			service.stopPruningTimer();
			jest.useRealTimers();
			jest.restoreAllMocks();
		});

		test('should schedule pruning on start and reschedule after each run', async () => {
			const repo = mock<AuditLogRepository>({
				delete: async () => ({ affected: 0, raw: [] }),
				count: async () => 0,
			});
			const svc = new AuditLogPruningService(repo, mockInstanceSettings, mockLogger());
			const pruneSpy = jest.spyOn(svc, 'pruneAuditLogs');
			const scheduleSpy = jest.spyOn(svc as any, 'scheduleNextPrune');

			svc.startPruningTimer();

			await jest.advanceTimersToNextTimerAsync();

			expect(pruneSpy).toHaveBeenCalledTimes(1);
			// Called once from startPruningTimer, once after successful prune
			expect(scheduleSpy).toHaveBeenCalledTimes(2);

			svc.stopPruningTimer();
		});

		test('should not reschedule if stopped during prune', async () => {
			const repo = mock<AuditLogRepository>({
				delete: async () => ({ affected: 0, raw: [] }),
				count: async () => 0,
			});
			const svc = new AuditLogPruningService(repo, mockInstanceSettings, mockLogger());

			let resolvePrune!: () => void;
			const pruneSpy = jest.spyOn(svc, 'pruneAuditLogs').mockImplementation(
				async () =>
					await new Promise((resolve) => {
						resolvePrune = () => resolve();
					}),
			);

			svc.startPruningTimer();
			jest.advanceTimersByTime(Time.hours.toMilliseconds + 1);

			svc.stopPruningTimer();
			resolvePrune();

			await jest.runOnlyPendingTimersAsync();

			expect(pruneSpy).toHaveBeenCalledTimes(1);
		});

		test('should retry with shorter delay on error', async () => {
			const deleteSpy = jest
				.spyOn(auditLogRepository, 'delete')
				.mockRejectedValueOnce(new Error('DB error'))
				.mockRejectedValueOnce(new Error('DB error'))
				.mockResolvedValueOnce({ affected: 0, raw: [] });
			jest.spyOn(auditLogRepository, 'count').mockResolvedValue(0);

			service.startPruningTimer();

			await service.pruneAuditLogs();
			// Two retries at 1-second delay
			await jest.advanceTimersByTimeAsync(Time.seconds.toMilliseconds * 2 + 1);

			expect(deleteSpy).toHaveBeenCalledTimes(3);
		});
	});

	describe('pruneAuditLogs', () => {
		beforeEach(() => {
			jest.useFakeTimers();
			jest.clearAllMocks();
			service.startPruningTimer();
		});

		afterEach(() => {
			service.stopPruningTimer();
			jest.useRealTimers();
			jest.restoreAllMocks();
		});

		test('should delete entries older than 5 days', async () => {
			const deleteSpy = jest
				.spyOn(auditLogRepository, 'delete')
				.mockResolvedValue({ affected: 5, raw: [] });
			jest.spyOn(auditLogRepository, 'count').mockResolvedValue(100);

			const now = Date.now();
			await service.pruneAuditLogs();

			expect(deleteSpy).toHaveBeenCalledTimes(1);
			const callArg = deleteSpy.mock.calls[0][0] as Record<string, unknown>;
			// Verify the cutoff date is approximately 5 days ago
			const cutoffDate = (callArg.timestamp as any)._value as Date;
			const expectedCutoff = now - 5 * Time.days.toMilliseconds;
			expect(Math.abs(cutoffDate.getTime() - expectedCutoff)).toBeLessThan(1000);
		});

		test('should delete excess entries when count exceeds 10,000', async () => {
			const deleteSpy = jest
				.spyOn(auditLogRepository, 'delete')
				.mockResolvedValue({ affected: 0, raw: [] });
			jest.spyOn(auditLogRepository, 'count').mockResolvedValue(10_500);
			const deleteOldestSpy = jest
				.spyOn(auditLogRepository, 'deleteOldestInBatches')
				.mockResolvedValue(500);

			await service.pruneAuditLogs();

			// Age-based delete is called once
			expect(deleteSpy).toHaveBeenCalledTimes(1);
			// deleteOldestInBatches should be called with the excess count
			expect(deleteOldestSpy).toHaveBeenCalledWith(500);
		});

		test('should not delete excess entries when count is within limit', async () => {
			jest.spyOn(auditLogRepository, 'delete').mockResolvedValue({ affected: 0, raw: [] });
			jest.spyOn(auditLogRepository, 'count').mockResolvedValue(5_000);
			const deleteOldestSpy = jest.spyOn(auditLogRepository, 'deleteOldestInBatches');

			await service.pruneAuditLogs();

			expect(auditLogRepository.delete).toHaveBeenCalledTimes(1);
			expect(deleteOldestSpy).not.toHaveBeenCalled();
		});
	});
});
