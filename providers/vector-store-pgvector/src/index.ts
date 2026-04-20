/**
 * MyCodexVantaOS PGVector Vector Store Provider
 * 
 * External provider for vector storage using PostgreSQL with pgvector extension.
 * naming-spec-v1 compliant: vector-store-pgvector
 * 
 * @module @mycodexvantaos/vector-store-pgvector
 */

import { Pool } from 'pg';
import {
  BaseProvider,
  VectorStoreProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderStatus
} from '@mycodexvantaos/namespaces-sdk';

/**
 * PGVector provider configuration
 * Environment variables follow naming-spec-v1 §7.2: MYCODEXVANTAOS_<SUBSYSTEM>_<KEY>
 */
export interface PgVectorProviderConfig extends ProviderConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  dimensions?: number;
  distanceMetric?: 'cosine' | 'euclidean' | 'inner_product';
  indexType?: 'ivfflat' | 'hnsw';
  poolSize?: number;
}

/**
 * Vector record with metadata
 */
export interface VectorRecord {
  id: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  content?: string;
}

/**
 * Search result with similarity score
 */
export interface SearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
  content?: string;
}

/**
 * Collection info
 */
export interface CollectionInfo {
  name: string;
  dimensions: number;
  distanceMetric: string;
  vectorCount: number;
  indexType: string;
}

/**
 * PGVector Vector Store Provider
 * 
 * Implements the VectorStoreProvider interface using PostgreSQL with pgvector extension.
 * Supports vector similarity search, metadata filtering, and hybrid queries.
 * 
 * @example
 * ```typescript
 * const provider = new PgVectorStoreProvider({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'vectors',
 *   user: 'admin',
 *   password: 'secret',
 *   dimensions: 1536
 * });
 * 
 * await provider.initialize();
 * await provider.createCollection('embeddings', 1536);
 * await provider.insertVectors('embeddings', [{ id: '1', vector: [0.1, 0.2, ...] }]);
 * const results = await provider.similaritySearch('embeddings', queryVector, 10);
 * ```
 */
export class PgVectorStoreProvider extends BaseProvider implements VectorStoreProvider {
  readonly id = 'vector-store-pgvector';
  readonly capability = 'vector-store' as const;
  readonly providerName = 'pgvector';
  
  private pool: Pool | null = null;
  private config: Required<PgVectorProviderConfig>;

  constructor(config: PgVectorProviderConfig) {
    super(config);
    this.config = {
      port: 5432,
      dimensions: 1536,
      distanceMetric: 'cosine',
      indexType: 'ivfflat',
      poolSize: 10,
      ...config
    } as Required<PgVectorProviderConfig>;
  }

  /**
   * Initialize the PostgreSQL connection and verify pgvector extension
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
      max: this.config.poolSize,
    });

    // Verify pgvector extension is installed
    const client = await this.pool.connect();
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      const result = await client.query('SELECT extversion FROM pg_extension WHERE extname = $1', ['vector']);
      
      if (result.rows.length === 0) {
        throw new Error('pgvector extension not available. Please install pgvector on your PostgreSQL server.');
      }
      
      console.log(`[vector-store-pgvector] pgvector extension v${result.rows[0].extversion} loaded`);
    } finally {
      client.release();
    }

    this.status = ProviderStatus.READY;
    console.log('[vector-store-pgvector] Initialized successfully');
  }

  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.status = ProviderStatus.STOPPED;
      console.log('[vector-store-pgvector] Shutdown complete');
    }
  }

  /**
   * Check provider health
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
        message: 'PGVector connection healthy',
        timestamp: new Date().toISOString(),
        latency,
        details: {
          dimensions: this.config.dimensions,
          distanceMetric: this.config.distanceMetric,
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
   * Get the distance operator for the configured metric
   */
  private getDistanceOperator(): string {
    switch (this.config.distanceMetric) {
      case 'cosine':
        return '<=>';
      case 'euclidean':
        return '<->';
      case 'inner_product':
        return '<#>';
      default:
        return '<=>';
    }
  }

  /**
   * Create a vector collection (table)
   */
  async createCollection(
    name: string, 
    dimensions?: number,
    options?: { indexType?: 'ivfflat' | 'hnsw'; lists?: number }
  ): Promise<void> {
    this.ensureReady();
    
    const dims = dimensions || this.config.dimensions;
    const indexType = options?.indexType || this.config.indexType;
    const lists = options?.lists || 100;

    // Create table with vector column
    await this.pool!.query(`
      CREATE TABLE IF NOT EXISTS ${name} (
        id TEXT PRIMARY KEY,
        embedding vector(${dims}),
        metadata JSONB DEFAULT '{}',
        content TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create vector index
    if (indexType === 'hnsw') {
      await this.pool!.query(`
        CREATE INDEX IF NOT EXISTS ${name}_embedding_idx 
        ON ${name} 
        USING hnsw (embedding ${this.getDistanceOperator()})
      `);
    } else {
      await this.pool!.query(`
        CREATE INDEX IF NOT EXISTS ${name}_embedding_idx 
        ON ${name} 
        USING ivfflat (embedding ${this.getDistanceOperator()}) 
        WITH (lists = ${lists})
      `);
    }

    // Create metadata index for filtering
    await this.pool!.query(`
      CREATE INDEX IF NOT EXISTS ${name}_metadata_idx 
      ON ${name} USING gin (metadata)
    `);

    console.log(`[vector-store-pgvector] Created collection: ${name} (${dims} dimensions)`);
  }

  /**
   * Delete a collection (table)
   */
  async deleteCollection(name: string): Promise<void> {
    this.ensureReady();
    await this.pool!.query(`DROP TABLE IF EXISTS ${name} CASCADE`);
    console.log(`[vector-store-pgvector] Deleted collection: ${name}`);
  }

  /**
   * Get collection info
   */
  async getCollectionInfo(name: string): Promise<CollectionInfo | null> {
    this.ensureReady();
    
    const tableResult = await this.pool!.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      ) as exists
    `, [name]);

    if (!tableResult.rows[0].exists) {
      return null;
    }

    const countResult = await this.pool!.query(`SELECT COUNT(*) as count FROM ${name}`);
    
    return {
      name,
      dimensions: this.config.dimensions,
      distanceMetric: this.config.distanceMetric,
      vectorCount: parseInt(countResult.rows[0].count),
      indexType: this.config.indexType
    };
  }

  /**
   * Insert vectors into a collection
   */
  async insertVectors(collection: string, records: VectorRecord[]): Promise<number> {
    this.ensureReady();
    
    let inserted = 0;
    const client = await this.pool!.connect();
    
    try {
      await client.query('BEGIN');
      
      for (const record of records) {
        await client.query(`
          INSERT INTO ${collection} (id, embedding, metadata, content)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (id) DO UPDATE SET
            embedding = EXCLUDED.embedding,
            metadata = EXCLUDED.metadata,
            content = EXCLUDED.content,
            updated_at = NOW()
        `, [
          record.id,
          `[${record.vector.join(',')}]`,
          JSON.stringify(record.metadata || {}),
          record.content || null
        ]);
        inserted++;
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return inserted;
  }

  /**
   * Update vectors in a collection
   */
  async updateVectors(collection: string, records: VectorRecord[]): Promise<number> {
    // Same as insert with ON CONFLICT
    return this.insertVectors(collection, records);
  }

  /**
   * Delete vectors from a collection
   */
  async deleteVectors(collection: string, ids: string[]): Promise<number> {
    this.ensureReady();
    
    const result = await this.pool!.query(
      `DELETE FROM ${collection} WHERE id = ANY($1)`,
      [ids]
    );
    
    return result.rowCount || 0;
  }

  /**
   * Perform similarity search
   */
  async similaritySearch(
    collection: string,
    vector: number[],
    k: number = 10,
    filter?: Record<string, unknown>
  ): Promise<SearchResult[]> {
    this.ensureReady();
    
    const operator = this.getDistanceOperator();
    const vectorStr = `[${vector.join(',')}]`;
    
    let query = `
      SELECT 
        id,
        embedding ${operator} '${vectorStr}'::vector as score,
        metadata,
        content
      FROM ${collection}
    `;
    
    const params: unknown[] = [];
    
    if (filter && Object.keys(filter).length > 0) {
      const conditions = Object.entries(filter).map(([key, value], i) => {
        params.push(value);
        return `metadata->>'${key}' = $${i + 1}`;
      });
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY embedding ${operator} '${vectorStr}'::vector LIMIT ${k}`;
    
    const result = await this.pool!.query(query, params);
    
    return result.rows.map(row => ({
      id: row.id,
      score: parseFloat(row.score),
      metadata: row.metadata,
      content: row.content
    }));
  }

  /**
   * Hybrid search combining vector similarity with full-text search
   */
  async hybridSearch(
    collection: string,
    vector: number[],
    query: string,
    k: number = 10,
    alpha: number = 0.5
  ): Promise<SearchResult[]> {
    this.ensureReady();
    
    const operator = this.getDistanceOperator();
    const vectorStr = `[${vector.join(',')}]`;
    
    const sql = `
      WITH vector_scores AS (
        SELECT 
          id,
          1 - (embedding ${operator} '${vectorStr}'::vector) as vector_score,
          metadata,
          content
        FROM ${collection}
        ORDER BY embedding ${operator} '${vectorStr}'::vector
        LIMIT ${k * 3}
      ),
      text_scores AS (
        SELECT 
          id,
          ts_rank_cd(to_tsvector('english', COALESCE(content, '')), plainto_tsquery('english', $1)) as text_score
        FROM ${collection}
        WHERE to_tsvector('english', COALESCE(content, '')) @@ plainto_tsquery('english', $1)
        LIMIT ${k * 3}
      )
      SELECT 
        v.id,
        (${alpha} * v.vector_score + ${(1 - alpha)} * COALESCE(t.text_score, 0)) as score,
        v.metadata,
        v.content
      FROM vector_scores v
      LEFT JOIN text_scores t ON v.id = t.id
      ORDER BY score DESC
      LIMIT ${k}
    `;
    
    const result = await this.pool!.query(sql, [query]);
    
    return result.rows.map(row => ({
      id: row.id,
      score: parseFloat(row.score),
      metadata: row.metadata,
      content: row.content
    }));
  }

  /**
   * Batch insert vectors
   */
  async batchInsert(
    collection: string,
    records: VectorRecord[],
    batchSize: number = 100
  ): Promise<number> {
    let totalInserted = 0;
    
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      totalInserted += await this.insertVectors(collection, batch);
    }
    
    return totalInserted;
  }

  private ensureReady(): void {
    if (!this.pool) {
      throw new Error('PGVector provider not initialized. Call initialize() first.');
    }
    if (this.status !== ProviderStatus.READY) {
      throw new Error(`PGVector provider not ready. Current status: ${this.status}`);
    }
  }
}

// Export provider class and types
export default PgVectorStoreProvider;