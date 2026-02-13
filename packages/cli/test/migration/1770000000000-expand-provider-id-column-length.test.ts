import {
	createTestMigrationContext,
	initDbUpToMigration,
	runSingleMigration,
	type TestMigrationContext,
} from '@n8n/backend-test-utils';
import { DbConnection } from '@n8n/db';
import { Container } from '@n8n/di';
import { DataSource } from '@n8n/typeorm';
import { randomUUID } from 'node:crypto';
import { nanoid } from 'nanoid';

const MIGRATION_NAME = 'ExpandProviderIdColumnLength1770000000000';

interface AuthIdentity {
	userId: string;
	providerId: string;
	providerType: string;
}

describe('ExpandProviderIdColumnLength Migration', () => {
	let dataSource: DataSource;

	beforeEach(async () => {
		const dbConnection = Container.get(DbConnection);
		await dbConnection.init();

		dataSource = Container.get(DataSource);
		const context = createTestMigrationContext(dataSource);
		await context.queryRunner.clearDatabase();
		await initDbUpToMigration(MIGRATION_NAME);
	});

	afterEach(async () => {
		const dbConnection = Container.get(DbConnection);
		await dbConnection.close();
	});

	/**
	 * Helper to get column data type from database schema
	 */
	async function getColumnType(
		context: TestMigrationContext,
		tableName: string,
		columnName: string,
	): Promise<string> {
		if (context.isPostgres) {
			const result = await context.runQuery<
				Array<{ data_type: string; character_maximum_length: number }>
			>(
				`SELECT data_type, character_maximum_length
				 FROM information_schema.columns
				 WHERE table_name = :tableName AND column_name = :columnName`,
				{
					tableName: `${context.tablePrefix}${tableName}`,
					columnName,
				},
			);
			return `${result[0]?.data_type}(${result[0]?.character_maximum_length})`;
		} else if (context.isSqlite) {
			const result = await context.runQuery<Array<{ name: string; type: string }>>(
				`PRAGMA table_info(${context.escape.tableName(tableName)})`,
			);
			const column = result.find((col) => col.name === columnName);
			return column?.type || 'unknown';
		}
		return 'unknown';
	}

	/**
	 * Helper to check if primary key constraint exists
	 */
	async function getPrimaryKeyColumns(
		context: TestMigrationContext,
		tableName: string,
	): Promise<string[]> {
		if (context.isPostgres) {
			const result = await context.runQuery<Array<{ column_name: string }>>(
				`SELECT a.attname as column_name
				 FROM pg_index i
				 JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
				 WHERE i.indrelid = :tableName::regclass AND i.indisprimary`,
				{
					tableName: `${context.tablePrefix}${tableName}`,
				},
			);
			return result.map((row) => row.column_name);
		} else if (context.isSqlite) {
			const result = await context.runQuery<Array<{ name: string; pk: number }>>(
				`PRAGMA table_info(${context.escape.tableName(tableName)})`,
			);
			return result
				.filter((col) => col.pk > 0)
				.sort((a, b) => a.pk - b.pk)
				.map((col) => col.name);
		}
		return [];
	}

	/**
	 * Helper to check if foreign key constraints exist
	 */
	async function getForeignKeys(
		context: TestMigrationContext,
		tableName: string,
	): Promise<Array<{ from: string; table: string; to: string }>> {
		if (context.isPostgres) {
			const result = await context.runQuery<Array<{ from: string; table: string; to: string }>>(
				`SELECT
					kcu.column_name as "from",
					ccu.table_name as "table",
					ccu.column_name as "to"
				 FROM information_schema.table_constraints AS tc
				 JOIN information_schema.key_column_usage AS kcu
				   ON tc.constraint_name = kcu.constraint_name
				   AND tc.table_schema = kcu.table_schema
				 JOIN information_schema.constraint_column_usage AS ccu
				   ON ccu.constraint_name = tc.constraint_name
				   AND ccu.table_schema = tc.table_schema
				 WHERE tc.constraint_type = 'FOREIGN KEY'
				   AND tc.table_name = :tableName`,
				{
					tableName: `${context.tablePrefix}${tableName}`,
				},
			);
			return result.map((row) => ({
				from: row.from,
				table: row.table.replace(context.tablePrefix, ''),
				to: row.to,
			}));
		} else if (context.isSqlite) {
			const result = await context.runQuery<Array<{ from: string; table: string; to: string }>>(
				`PRAGMA foreign_key_list(${context.escape.tableName(tableName)})`,
			);
			return result.map((fk) => ({
				from: fk.from,
				table: fk.table,
				to: fk.to,
			}));
		}
		return [];
	}

	/**
	 * Helper to insert test user (prerequisite)
	 */
	async function insertTestUser(context: TestMigrationContext, userId: string): Promise<void> {
		const tableName = context.escape.tableName('user');
		const idColumn = context.escape.columnName('id');
		const emailColumn = context.escape.columnName('email');
		const firstNameColumn = context.escape.columnName('firstName');
		const lastNameColumn = context.escape.columnName('lastName');
		const passwordColumn = context.escape.columnName('password');
		const createdAtColumn = context.escape.columnName('createdAt');
		const updatedAtColumn = context.escape.columnName('updatedAt');

		await context.runQuery(
			`INSERT INTO ${tableName} (${idColumn}, ${emailColumn}, ${firstNameColumn}, ${lastNameColumn}, ${passwordColumn}, ${createdAtColumn}, ${updatedAtColumn})
			 VALUES (:userId, :email, :firstName, :lastName, :password, :createdAt, :updatedAt)`,
			{
				userId,
				email: 'test@example.com',
				firstName: 'Test',
				lastName: 'User',
				password: 'hashed_password',
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		);
	}

	/**
	 * Helper to insert auth identity
	 */
	async function insertAuthIdentity(
		context: TestMigrationContext,
		identity: AuthIdentity,
	): Promise<void> {
		const tableName = context.escape.tableName('auth_identity');
		const userIdColumn = context.escape.columnName('userId');
		const providerIdColumn = context.escape.columnName('providerId');
		const providerTypeColumn = context.escape.columnName('providerType');
		const createdAtColumn = context.escape.columnName('createdAt');
		const updatedAtColumn = context.escape.columnName('updatedAt');

		await context.runQuery(
			`INSERT INTO ${tableName} (${userIdColumn}, ${providerIdColumn}, ${providerTypeColumn}, ${createdAtColumn}, ${updatedAtColumn})
			 VALUES (:userId, :providerId, :providerType, :createdAt, :updatedAt)`,
			{
				userId: identity.userId,
				providerId: identity.providerId,
				providerType: identity.providerType,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		);
	}

	/**
	 * Helper to get auth identity
	 */
	async function getAuthIdentity(
		context: TestMigrationContext,
		providerId: string,
		providerType: string,
	): Promise<AuthIdentity | null> {
		const tableName = context.escape.tableName('auth_identity');
		const userIdColumn = context.escape.columnName('userId');
		const providerIdColumn = context.escape.columnName('providerId');
		const providerTypeColumn = context.escape.columnName('providerType');

		const result = await context.runQuery<AuthIdentity[]>(
			`SELECT ${userIdColumn} as userId, ${providerIdColumn} as providerId, ${providerTypeColumn} as providerType
			 FROM ${tableName}
			 WHERE ${providerIdColumn} = :providerId
			   AND ${providerTypeColumn} = :providerType`,
			{
				providerId,
				providerType,
			},
		);

		return result[0] || null;
	}

	describe('up migration', () => {
		it('should preserve all data during migration', async () => {
			const context = createTestMigrationContext(dataSource);

			// Create test user
			const userId = context.isPostgres ? randomUUID() : nanoid();
			await insertTestUser(context, userId);

			// Test with various providerId values
			const testIdentities: AuthIdentity[] = [
				{
					userId,
					providerId: 'short-id',
					providerType: 'ldap',
				},
				{
					userId,
					providerId: '1234567890123456789012345678901234567890123456789012345678901234', // Max length for varchar(64)
					providerType: 'saml',
				},
			];

			// Insert test identities
			for (const identity of testIdentities) {
				await insertAuthIdentity(context, identity);
			}

			// Verify pre-migration data
			const beforeMigration1 = await getAuthIdentity(
				context,
				testIdentities[0].providerId,
				testIdentities[0].providerType,
			);
			expect(beforeMigration1).toBeDefined();
			expect(beforeMigration1?.userId).toBe(userId);

			const beforeMigration2 = await getAuthIdentity(
				context,
				testIdentities[1].providerId,
				testIdentities[1].providerType,
			);
			expect(beforeMigration2).toBeDefined();
			expect(beforeMigration2?.userId).toBe(userId);

			await context.queryRunner.release();

			// Run migration
			await runSingleMigration(MIGRATION_NAME);

			// Create fresh context after migration
			const postContext = createTestMigrationContext(dataSource);

			// Verify data is preserved
			const afterMigration1 = await getAuthIdentity(
				postContext,
				testIdentities[0].providerId,
				testIdentities[0].providerType,
			);
			expect(afterMigration1).toBeDefined();
			expect(afterMigration1?.providerId).toBe(testIdentities[0].providerId);
			expect(afterMigration1?.userId).toBe(userId);

			const afterMigration2 = await getAuthIdentity(
				postContext,
				testIdentities[1].providerId,
				testIdentities[1].providerType,
			);
			expect(afterMigration2).toBeDefined();
			expect(afterMigration2?.providerId).toBe(testIdentities[1].providerId);
			expect(afterMigration2?.userId).toBe(userId);

			await postContext.queryRunner.release();
		});

		it('should change providerId column type from varchar(64) to varchar(255) for PostgreSQL', async () => {
			await runSingleMigration(MIGRATION_NAME);

			const context = createTestMigrationContext(dataSource);

			// Check column type after migration
			const columnType = await getColumnType(context, 'auth_identity', 'providerId');

			if (context.isPostgres) {
				expect(columnType).toBe('character varying(255)');
			} else if (context.isSqlite) {
				// SQLite doesn't enforce VARCHAR lengths, so we just check it's VARCHAR
				expect(columnType.toUpperCase()).toContain('VARCHAR');
			}

			await context.queryRunner.release();
		});

		it('should preserve composite primary key constraint', async () => {
			await runSingleMigration(MIGRATION_NAME);

			const context = createTestMigrationContext(dataSource);

			// Check primary key columns
			const pkColumns = await getPrimaryKeyColumns(context, 'auth_identity');

			expect(pkColumns).toHaveLength(2);
			expect(pkColumns).toContain('providerId');
			expect(pkColumns).toContain('providerType');

			await context.queryRunner.release();
		});

		it('should preserve foreign key constraints', async () => {
			await runSingleMigration(MIGRATION_NAME);

			const context = createTestMigrationContext(dataSource);

			// Check foreign keys
			const foreignKeys = await getForeignKeys(context, 'auth_identity');

			// Should have foreign key to user table
			expect(foreignKeys.length).toBeGreaterThanOrEqual(1);

			// Check userId FK
			const userFk = foreignKeys.find((fk) => fk.from === 'userId');
			expect(userFk).toBeDefined();
			expect(userFk?.table).toBe('user');
			expect(userFk?.to).toBe('id');

			await context.queryRunner.release();
		});

		it('should allow inserting providerId values longer than 64 characters after migration (PostgreSQL only)', async () => {
			await runSingleMigration(MIGRATION_NAME);

			const context = createTestMigrationContext(dataSource);

			// Skip test for SQLite as it doesn't enforce VARCHAR lengths
			if (context.isSqlite) {
				await context.queryRunner.release();
				return;
			}

			const userId = context.isPostgres ? randomUUID() : nanoid();
			await insertTestUser(context, userId);

			// Insert identity with long providerId (> 64 characters)
			const longProviderId =
				'this-is-a-very-long-provider-id-that-exceeds-64-characters-by-a-lot-and-should-work-after-migration';
			const identity: AuthIdentity = {
				userId,
				providerId: longProviderId,
				providerType: 'ldap',
			};

			await insertAuthIdentity(context, identity);

			// Verify the long providerId was stored correctly
			const retrieved = await getAuthIdentity(context, longProviderId, 'ldap');

			expect(retrieved).toBeDefined();
			expect(retrieved?.providerId).toBe(longProviderId);
			expect(retrieved?.providerId.length).toBeGreaterThan(64);
			expect(retrieved?.userId).toBe(userId);

			await context.queryRunner.release();
		});

		it('should maintain primary key uniqueness constraint', async () => {
			await runSingleMigration(MIGRATION_NAME);

			const context = createTestMigrationContext(dataSource);

			const userId = context.isPostgres ? randomUUID() : nanoid();
			await insertTestUser(context, userId);

			const providerId = 'duplicate-test-id';
			const providerType = 'ldap';

			// Insert first identity
			await insertAuthIdentity(context, {
				userId,
				providerId,
				providerType,
			});

			// Try to insert duplicate - should fail
			await expect(
				insertAuthIdentity(context, {
					userId: context.isPostgres ? randomUUID() : nanoid(), // Different user, but same providerId+providerType combo
					providerId,
					providerType,
				}),
			).rejects.toThrow();

			await context.queryRunner.release();
		});

		it('should preserve all existing auth identities with various providerId lengths', async () => {
			const context = createTestMigrationContext(dataSource);

			const userId = context.isPostgres ? randomUUID() : nanoid();
			await insertTestUser(context, userId);

			// Generate test identities with various providerId lengths
			const testIdentities: AuthIdentity[] = [
				{ userId, providerId: 'a', providerType: 'ldap' }, // 1 char
				{ userId, providerId: 'short', providerType: 'saml' }, // 5 chars
				{
					userId,
					providerId: '1234567890123456789012345678901234567890123456789012345678901234',
					providerType: 'oidc',
				}, // 64 chars (max before migration)
			];

			// Insert all test identities before migration
			for (const identity of testIdentities) {
				await insertAuthIdentity(context, identity);
			}

			// Verify all identities exist before migration
			const tableName = context.escape.tableName('auth_identity');
			const userIdColumn = context.escape.columnName('userId');
			const beforeCount = await context.runQuery<Array<{ count: number }>>(
				`SELECT COUNT(*) as count FROM ${tableName} WHERE ${userIdColumn} = :userId`,
				{ userId },
			);
			expect(Number(beforeCount[0].count)).toBe(3);

			await context.queryRunner.release();

			// Run migration
			await runSingleMigration(MIGRATION_NAME);

			// Create fresh context after migration
			const postContext = createTestMigrationContext(dataSource);

			// Verify all 3 identities still exist after migration
			const afterCount = await postContext.runQuery<Array<{ count: number }>>(
				`SELECT COUNT(*) as count FROM ${tableName} WHERE ${userIdColumn} = :userId`,
				{ userId },
			);
			expect(Number(afterCount[0].count)).toBe(3);

			// Verify each identity's data is intact
			for (const originalIdentity of testIdentities) {
				const retrieved = await getAuthIdentity(
					postContext,
					originalIdentity.providerId,
					originalIdentity.providerType,
				);

				expect(retrieved).toBeDefined();
				expect(retrieved?.providerId).toBe(originalIdentity.providerId);
				expect(retrieved?.userId).toBe(originalIdentity.userId);
				expect(retrieved?.providerType).toBe(originalIdentity.providerType);
			}

			await postContext.queryRunner.release();
		});
	});
});
