/**
 * DatabaseProvider Interface
 *
 * Abstraction for all database operations.
 * Platform MUST provide a native implementation (e.g. SQLite).
 * External providers (Postgres, Supabase, Neon) are optional connectors.
 *
 * @layer Layer C (Native Services) + Layer D (Connector)
 */

export interface MigrationResult {
  applied: string[];
  skipped: string[];
  errors: Array<{ migration: string; error: string }>;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  rowCount: number;
  duration: number;
}

export interface DatabaseHealth {
  connected: boolean;
  latency: number;
  provider: string;
  version?: string;
}

export interface DatabaseProvider {
  /** Unique provider identifier */
  readonly providerId: string;

  /** Provider mode: 'native' | 'external' */
  readonly mode: 'native' | 'external';

  /** Initialize connection and verify availability */
  init(): Promise<void>;

  /** Run pending migrations */
  migrate(migrationsPath?: string): Promise<MigrationResult>;

  /** Execute a parameterized query */
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;

  /** Execute a write operation (INSERT, UPDATE, DELETE) */
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>;

  /** Run multiple operations in a transaction */
  transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T>;

  /** Health check */
  healthcheck(): Promise<DatabaseHealth>;

  /** Graceful shutdown */
  close(): Promise<void>;
}

export interface TransactionContext {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>;
}