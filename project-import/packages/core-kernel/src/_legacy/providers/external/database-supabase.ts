/**
 * SupabaseDatabaseProvider — External PostgreSQL via Supabase
 * 
 * Example external provider showing how a third-party database
 * plugs into the DatabaseProvider interface.
 * 
 * This is a CONNECTOR, not a foundation. The platform works
 * without it via NativeDatabaseProvider (SQLite).
 */

import type {
  DatabaseProvider,
  QueryResult,
  MigrationResult,
  TransactionContext,
  DatabaseHealth,
} from '../../interfaces/database';

interface SupabaseDbConfig {
  connectionString: string;
  poolSize?: number;
  ssl?: boolean;
}

/**
 * Implementation notes:
 * - Uses `pg` (node-postgres) under the hood
 * - Connection pooling via pg.Pool
 * - SSL enabled by default for Supabase
 * - Migrations via same numbered SQL file convention
 * 
 * Install dependencies:
 *   npm install pg @types/pg
 */
export class SupabaseDatabaseProvider implements DatabaseProvider {
  readonly providerId = 'external-supabase-postgres';
  readonly mode = 'external' as const;

  private pool: any = null;
  private config: SupabaseDbConfig;

  constructor(config: SupabaseDbConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    // Dynamic import to avoid hard dependency
    const { Pool } = await import('pg');
    this.pool = new Pool({
      connectionString: this.config.connectionString,
      max: this.config.poolSize ?? 10,
      ssl: this.config.ssl !== false ? { rejectUnauthorized: false } : false,
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  async migrate(migrationsPath?: string): Promise<MigrationResult> {
    const fs = await import('fs');
    const path = await import('path');
    const migDir = migrationsPath ?? path.join(process.cwd(), 'migrations');
    const applied: string[] = [];
    const skipped: string[] = [];

    // Create migration table
    await this.execute(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        checksum TEXT
      )
    `);

    if (!fs.existsSync(migDir)) {
      return { applied, skipped, total: 0, success: true };
    }

    const files = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql')).sort();
    const { rows: existing } = await this.query<{ filename: string }>(
      'SELECT filename FROM _migrations'
    );
    const existingSet = new Set(existing.map(r => r.filename));

    for (const file of files) {
      if (existingSet.has(file)) { skipped.push(file); continue; }
      const sql = fs.readFileSync(path.join(migDir, file), 'utf-8');
      await this.execute(sql);
      await this.execute(
        'INSERT INTO _migrations (filename) VALUES ($1)',
        [file]
      );
      applied.push(file);
    }

    return { applied, skipped, total: files.length, success: true };
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? result.rows.length,
      duration: Date.now() - start,
    };
  }

  async execute(
    sql: string,
    params?: unknown[]
  ): Promise<{ affectedRows: number }> {
    const result = await this.pool.query(sql, params);
    return { affectedRows: result.rowCount ?? 0 };
  }

  async transaction<T>(fn: (tx: TransactionContext) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const tx: TransactionContext = {
        query: async <R = Record<string, unknown>>(sql: string, params?: unknown[]) => {
          const start = Date.now();
          const result = await client.query(sql, params);
          return { rows: result.rows as R[], rowCount: result.rowCount ?? 0, duration: Date.now() - start };
        },
        execute: async (sql: string, params?: unknown[]) => {
          const result = await client.query(sql, params);
          return { affectedRows: result.rowCount ?? 0 };
        },
      };
      const result = await fn(tx);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async healthcheck(): Promise<DatabaseHealth> {
    const start = Date.now();
    try {
      const { rows } = await this.query<{ version: string }>('SELECT version()');
      return {
        healthy: true,
        mode: 'external',
        provider: this.providerId,
        latencyMs: Date.now() - start,
        details: { version: rows[0]?.version, poolSize: this.config.poolSize },
      };
    } catch (err) {
      return {
        healthy: false,
        mode: 'external',
        provider: this.providerId,
        latencyMs: Date.now() - start,
        details: { error: String(err) },
      };
    }
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}