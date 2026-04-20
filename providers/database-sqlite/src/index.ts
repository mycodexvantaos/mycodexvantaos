/**
 * MyCodexVantaOS SQLite Database Provider
 * 
 * Native SQLite database provider implementing the DatabaseProvider interface
 * Following naming-spec-v1 §8.1: database-sqlite
 * 
 * @package @mycodexvantaos/database-sqlite
 * @version 1.0.0
 */

import Database from 'better-sqlite3';
import {
  DatabaseProvider,
  HealthCheckResult,
  ProviderSource,
  ProviderCriticality,
  ResolvedMode,
} from '@mycodexvantaos/namespaces-sdk';

/**
 * SQLite provider configuration
 */
export interface SQLiteProviderConfig {
  /** Database file path (default: :memory:) */
  filename?: string;
  /** Enable WAL mode for better concurrency */
  walMode?: boolean;
  /** Enable foreign key constraints */
  foreignKeys?: boolean;
  /** Busy timeout in milliseconds */
  busyTimeout?: number;
}

/**
 * SQLite Database Provider
 * 
 * Provides native SQLite database capability for MyCodexVantaOS
 */
export class SQLiteDatabaseProvider implements DatabaseProvider {
  readonly capability = 'database' as const;
  readonly source: ProviderSource = 'native';
  readonly criticality: ProviderCriticality = 'critical';
  readonly supportsModes: ResolvedMode[] = ['native', 'hybrid'];

  private db: Database.Database | null = null;
  private config: SQLiteProviderConfig;
  private filename: string;

  constructor(config: SQLiteProviderConfig = {}) {
    this.config = config;
    this.filename = config.filename || ':memory:';
  }

  /**
   * Initialize the SQLite database
   */
  async initialize(config?: unknown): Promise<void> {
    if (this.db) {
      return; // Already initialized
    }

    // Merge configuration
    const finalConfig: SQLiteProviderConfig = {
      ...this.config,
      ...(config as SQLiteProviderConfig || {}),
    };

    // Create database connection
    this.db = new Database(this.filename);

    // Apply configuration
    if (finalConfig.foreignKeys !== false) {
      this.db.pragma('foreign_keys = ON');
    }

    if (finalConfig.walMode) {
      this.db.pragma('journal_mode = WAL');
    }

    if (finalConfig.busyTimeout) {
      this.db.pragma(`busy_timeout = ${finalConfig.busyTimeout}`);
    }

    // Optimize for performance
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = -64000'); // 64MB cache
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.db) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        message: 'Database not initialized',
      };
    }

    try {
      // Simple query to verify database is responsive
      const result = this.db.prepare('SELECT 1 as health').get() as { health: number };
      
      return {
        status: 'healthy',
        timestamp: new Date(),
        message: 'SQLite database is responsive',
        details: {
          filename: this.filename,
          open: this.db.open,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Execute a SQL query and return results
   */
  async query(sql: string, params: unknown[] = []): Promise<unknown[]> {
    this.ensureInitialized();
    
    try {
      const stmt = this.db!.prepare(sql);
      
      if (stmt.reader) {
        return stmt.all(...params) as unknown[];
      } else {
        // For non-SELECT queries, return empty array
        stmt.run(...params);
        return [];
      }
    } catch (error) {
      throw new Error(`SQLite query error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a SQL statement and return affected rows count
   */
  async execute(sql: string, params: unknown[] = []): Promise<{ affectedRows: number }> {
    this.ensureInitialized();
    
    try {
      const stmt = this.db!.prepare(sql);
      const result = stmt.run(...params);
      
      return {
        affectedRows: result.changes,
      };
    } catch (error) {
      throw new Error(`SQLite execute error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (client: unknown) => Promise<T>): Promise<T> {
    this.ensureInitialized();
    
    const transaction = this.db!.transaction(async () => {
      return await callback(this.db);
    });
    
    return transaction();
  }

  /**
   * Run a raw SQL statement (SQLite-specific)
   */
  run(sql: string, params: unknown[] = []): Database.RunResult {
    this.ensureInitialized();
    return this.db!.prepare(sql).run(...params);
  }

  /**
   * Get a single row
   */
  get<T = unknown>(sql: string, params: unknown[] = []): T | undefined {
    this.ensureInitialized();
    return this.db!.prepare(sql).get(...params) as T | undefined;
  }

  /**
   * Get all rows
   */
  all<T = unknown>(sql: string, params: unknown[] = []): T[] {
    this.ensureInitialized();
    return this.db!.prepare(sql).all(...params) as T[];
  }

  /**
   * Prepare a statement for reuse
   */
  prepare(sql: string): Database.Statement {
    this.ensureInitialized();
    return this.db!.prepare(sql);
  }

  /**
   * Execute a prepared statement multiple times with different parameters
   */
  async executeBatch(sql: string, paramsArray: unknown[][]): Promise<{ affectedRows: number }> {
    this.ensureInitialized();
    
    const stmt = this.db!.prepare(sql);
    let totalChanges = 0;
    
    const insertMany = this.db!.transaction((items: unknown[][]) => {
      for (const params of items) {
        const result = stmt.run(...params);
        totalChanges += result.changes;
      }
    });
    
    insertMany(paramsArray);
    
    return { affectedRows: totalChanges };
  }

  /**
   * Get database statistics
   */
  getStats(): {
    filename: string;
    open: boolean;
    inTransaction: boolean;
    readonly: boolean;
    memory: boolean;
  } {
    if (!this.db) {
      return {
        filename: this.filename,
        open: false,
        inTransaction: false,
        readonly: false,
        memory: this.filename === ':memory:',
      };
    }

    return {
      filename: this.filename,
      open: this.db.open,
      inTransaction: this.db.inTransaction,
      readonly: this.db.readonly,
      memory: this.filename === ':memory:',
    };
  }

  /**
   * Close the database connection
   */
  async shutdown(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Backup database to a file
   */
  async backup(filename: string): Promise<void> {
    this.ensureInitialized();
    
    await this.db!.backup(filename);
  }

  /**
   * Serialize database to a buffer
   */
  async serialize(): Promise<Buffer> {
    this.ensureInitialized();
    
    return this.db!.serialize();
  }

  /**
   * Load a database from a buffer
   */
  async load(buffer: Buffer): Promise<void> {
    if (this.db) {
      this.db.close();
    }
    
    // Write buffer to temporary file and open it
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const tempFile = path.join(os.tmpdir(), `mycodexvantaos-${Date.now()}.db`);
    fs.writeFileSync(tempFile, buffer);
    
    this.db = new Database(tempFile);
    this.filename = tempFile;
  }

  /**
   * Ensure database is initialized
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
  }
}

/**
 * Export provider instance for easy registration
 */
export function createSQLiteProvider(config?: SQLiteProviderConfig): SQLiteDatabaseProvider {
  return new SQLiteDatabaseProvider(config);
}

/**
 * Default export
 */
export default SQLiteDatabaseProvider;