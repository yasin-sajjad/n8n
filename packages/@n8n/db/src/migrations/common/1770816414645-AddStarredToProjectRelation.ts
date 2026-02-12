import type { MigrationContext, ReversibleMigration } from '../migration-types';

export class AddStarredToProjectRelation1770816414645 implements ReversibleMigration {
	async up({ escape, runQuery }: MigrationContext) {
		const projectRelation = escape.tableName('project_relation');
		const starred = escape.columnName('starred');

		await runQuery(
			`ALTER TABLE ${projectRelation} ADD COLUMN ${starred} BOOLEAN NOT NULL DEFAULT false`,
		);
	}

	async down({ escape, runQuery }: MigrationContext) {
		const projectRelation = escape.tableName('project_relation');
		const starred = escape.columnName('starred');

		await runQuery(`ALTER TABLE ${projectRelation} DROP COLUMN ${starred}`);
	}
}
