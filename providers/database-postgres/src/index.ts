/**
 * MyCodexVantaOS PostgreSQL Database Provider
 * 
 * External provider for PostgreSQL database operations.
 * naming-spec-v1 compliant: database-postgres
 * 
 * @module @mycodexvantaos/database-postgres
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import {
  BaseProvider,
  DatabaseProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderStatus
} from '@mycodexvantaos/namespaces-sdk';

/**
 * PostgreSQL provider configuration
 * Environment variables follow naming-spec-v1 §7.2: MYCODEXVANTAOS_<SUBSYSTEM>_<KEY>
 */
export interface PostgresProviderConfig extends ProviderConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
  poolSize?: number;
  connectionTimeout?: number;
  idleTimeout?: number;
}

/**
 * Query options for PostgreSQL operations
 */
export interface PostgresQueryOptions {
  timeout?: number;
  fetchSize?: number;
  batchSize?: number;
}

/**
 * Transaction isolation levels
 */
export type IsolationLevel = 
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

/**
 * PostgreSQL Database Provider
 * 
 * Implements the DatabaseProvider interface for PostgreSQL databases.
 * Supports connection pooling, transactions, batch operations, and streaming.
 * 
 * @example
 * ```typescript
 * const provider = new PostgresDatabaseProvider({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'mycodexvantaos',
 *   user: 'admin',
 *   password: 'secret'
 * });
 * 
 * await provider.initialize();
 * const result = await provider.query('SELECT * FROM users WHERE id = $1', [1]);
 * ```
 */
export class PostgresDatabaseProvider extends BaseProvider implements DatabaseProvider {
  readonly id = 'database-postgres';
  readonly capability = 'database' as const;
  readonly providerName = 'postgres';
  
  private pool: Pool | null = null;
  private config: PostgresProviderConfig;

  constructor(config: PostgresProviderConfig) {
    super(config);
    this.config = {
      port: 5432,
      ssl: true,
      poolSize: 10,
      connectionTimeout: 30000,
      idleTimeout: 10000,
      ...config
    };
  }

  /**
   * Initialize the PostgreSQL connection pool
   */
  async initialize(): Promise<void> {
    if (this.pool) {
      return;
    }

    this.pool = new Pool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : false,
      max: this.config.poolSize,
      connectionTimeoutMillis: this.config.connectionTimeout,
      idleTimeoutMillis: this.config.idleTimeout,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('[database-postgres] Pool error:', err);
    });

    // Test connection
    const client = await this.pool.connect();
    await client.query('SELECT NOW()');
    client.release();

    this.status = ProviderStatus.READY;
    console.log('[database-postgres] Initialized successfully');
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.status = ProviderStatus.STOPPED;
      console.log('[database-postgres] Shutdown complete');
    }
  }

  /**
   * Check database health
   */
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.pool) {
        return {
          status: ProviderStatus.ERROR,
          message: 'Connection pool not initialized',
          timestamp: new Date().toISOString(),
          latency: 0
        };
      }

      const result = await this.pool.query('SELECT 1 as health');
      const latency = Date.now() - startTime;

      return {
        status: ProviderStatus.READY,
        message: 'PostgreSQL connection healthy',
        timestamp: new Date().toISOString(),
        latency,
        details: {
          rowCount: result.rowCount,
          poolSize: this.config.poolSize,
          database: this.config.database
        }
      };
    } catch (error) {
      return {
        status: ProviderStatus.ERROR,
        message: `Health check failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Execute a query and return results
   */
  async query<T = QueryResultRow>(
    sql: string, 
    params?: unknown[], 
    options?: PostgresQueryOptions
  ): Promise<T[]> {
    this.ensureReady();
    
    const result = await this.pool!.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Execute a query and return the full result
   */
  async queryWithMeta<T = QueryResultRow>(
    sql: string, 
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    this.ensureReady();
    return await this.pool!.query<T>(sql, params);
  }

  /**
   * Execute a statement (INSERT, UPDATE, DELETE) and return affected rows
   */
  async execute(sql: string, params?: unknown[]): Promise<number> {
    this.ensureReady();
    
    const result = await this.pool!.query(sql, params);
    return result.rowCount || 0;
  }

  /**
   * Execute multiple statements in a batch
   */
  async batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<number[]> {
    this.ensureReady();
    
    const results: number[] = [];
    const client = await this.pool!.connect();
    
    try {
      for (const { sql, params } of statements) {
        const result = await client.query(sql, params);
        results.push(result.rowCount || 0);
      }
      return results;
    } finally {
      client.release();
    }
  }

  /**
   * Execute operations within a transaction
   */
  async transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>,
    isolationLevel: IsolationLevel = 'READ COMMITTED'
  ): Promise<T> {
    this.ensureReady();
    
    const client = await this.pool!.connect();
    
    try {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      
      const txContext: TransactionContext = {
        query: async (sql: string, params?: unknown[]) => {
          const result = await client.query(sql, params);
          return result.rows;
        },
        execute: async (sql: string, params?: unknown[]) => {
          const result = await client.query(sql, params);
          return result.rowCount || 0;
        }
      };
      
      const result = await callback(txContext);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Stream query results
   */
  async *stream<T = QueryResultRow>(
    sql: string, 
    params?: unknown[], 
    fetchSize: number = 100
  ): AsyncGenerator<T, void, unknown> {
    this.ensureReady();
    
    const client = await this.pool!.connect();
    
    try {
      // Use a cursor for streaming
      const cursorName = `cursor_${Date.now()}`;
      await client.query(`BEGIN`);
      await client.query(`DECLARE ${cursorName} CURSOR FOR ${sql}`, params);
      
      while (true) {
        const result = await client.query(`FETCH ${fetchSize} FROM ${cursorName}`);
        if (result.rows.length === 0) {
          break;
        }
        for (const row of result.rows) {
          yield row as T;
        }
      }
      
      await client.query(`CLOSE ${cursorName}`);
      await client.query('COMMIT');
    } finally {
      client.release();
    }
  }

  /**
   * Get database schema information
   */
  async getSchema(): Promise<SchemaInfo> {
    const tables = await this.query<TableInfo>(`
      SELECT 
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    return { tables };
  }

  /**
   * Run migrations (placeholder for migration system)
   */
  async migrate(migrationsPath: string): Promise<MigrationResult> {
    // This would integrate with a migration tool like pg-migrate
    console.log(`[database-postgres] Migrations from ${migrationsPath} not implemented`);
    return {
      applied: [],
      pending: [],
      errors: []
    };
  }

  private ensureReady(): void {
    if (!this.pool) {
      throw new Error('PostgreSQL provider not initialized. Call initialize() first.');
    }
    if (this.status !== ProviderStatus.READY) {
      throw new Error(`PostgreSQL provider not ready. Current status: ${this.status}`);
    }
  }
}

/**
 * Transaction context for callback-based transactions
 */
export interface TransactionContext {
  query<T = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<number>;
}

/**
 * Schema information
 */
export interface SchemaInfo {
  tables: TableInfo[];
}

export interface TableInfo {
  table_name: string;
  table_type: string;
}

/**
 * Migration result
 */
export interface MigrationResult {
  applied: string[];
  pending: string[];
  errors: Error[];
}

// Export provider class and types
export default PostgresDatabaseProvider;