import { Service } from '@n8n/di';
import { DataSource, Repository } from '@n8n/typeorm';

import { AuditLog } from '../entities';

@Service()
export class AuditLogRepository extends Repository<AuditLog> {
	constructor(dataSource: DataSource) {
		super(AuditLog, dataSource.manager);
	}

	/**
	 * Deletes the oldest audit log entries in batches to avoid loading all IDs into memory
	 * @param count - Total number of entries to delete
	 * @param batchSize - Number of entries to delete per batch (default: 1000)
	 * @returns Total number of deleted entries
	 */
	async deleteOldestInBatches(count: number, batchSize = 1000): Promise<number> {
		let deletedCount = 0;
		const tableName = this.metadata.tableName;

		while (deletedCount < count) {
			const remaining = Math.min(batchSize, count - deletedCount);

			// Fetch just the IDs as a flat array
			const result: Array<{ id: string }> = await this.manager.query(
				`SELECT id FROM ${tableName} ORDER BY timestamp ASC LIMIT $1`,
				[remaining],
			);

			if (result.length === 0) break;

			const ids = result.map((row) => row.id);
			await this.delete(ids);
			deletedCount += ids.length;
		}

		return deletedCount;
	}
}
