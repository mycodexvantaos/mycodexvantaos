/**
 * MyCodexVantaOS Vector Store Service
 * 
 * Vector storage service implementing semantic search capabilities
 * Following naming-spec-v1 §5.1: mycodexvantaos-data-vector-store
 * 
 * @package @mycodexvantaos/data-vector-store
 * @version 1.0.0
 */

import {
  createSDK,
  VectorStoreProvider,
  DatabaseProvider,
  ObservabilityProvider,
  HealthCheckResult,
} from '@mycodexvantaos/namespaces-sdk';
import { MyCodexVantaOSMapper, MyCodexVantaOSValidator } from '@mycodexvantaos/taxonomy-core';

/**
 * Service configuration
 */
export interface VectorStoreServiceConfig {
  /** Default vector dimension */
  defaultDimension: number;
  /** Default similarity metric */
  defaultMetric: 'cosine' | 'euclidean' | 'dot-product';
  /** Maximum collection size */
  maxCollectionSize: number;
  /** Enable persistence */
  enablePersistence: boolean;
  /** Database path (for persistence) */
  databasePath?: string;
}

/**
 * Collection metadata
 */
export interface CollectionInfo {
  name: string;
  dimension: number;
  metric: string;
  vectorCount: number;
  createdAt: Date;
}

/**
 * Vector entry
 */
export interface VectorEntry {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
}

/**
 * Query result
 */
export interface QueryResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  providers: Record<string, string>;
  collections: number;
  totalVectors: number;
}

/**
 * MyCodexVantaOS Vector Store Service
 */
export class VectorStoreService {
  private static readonly SERVICE_ID = 'mycodexvantaos-data-vector-store';
  private static readonly VERSION = '1.0.0';

  private config: VectorStoreServiceConfig;
  private sdk: Awaited<ReturnType<typeof createSDK>> | null = null;
  private vectorProvider: VectorStoreProvider | null = null;
  private dbProvider: DatabaseProvider | null = null;
  private observabilityProvider: ObservabilityProvider | null = null;
  private startTime: Date;
  private collections: Map<string, CollectionInfo> = new Map();

  constructor(config: Partial<VectorStoreServiceConfig> = {}) {
    this.config = {
      defaultDimension: 1536,
      defaultMetric: 'cosine',
      maxCollectionSize: 1000000,
      enablePersistence: false,
      ...config,
    };
    this.startTime = new Date();

    // Validate service ID
    const validation = MyCodexVantaOSValidator.validateServiceId(VectorStoreService.SERVICE_ID);
    if (!validation.valid) {
      throw new Error(`Invalid service ID: ${validation.violations.map(v => v.message).join(', ')}`);
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Create SDK instance
    this.sdk = await createSDK({
      debug: process.env.MYCODEXVANTAOS_DEBUG === 'true',
      mode: 'native',
    });

    // Get providers
    const registry = this.sdk.getRegistry();
    
    // Get vector store provider
    this.vectorProvider = registry.getByCapabilityFirst('vector-store') as VectorStoreProvider;
    if (!this.vectorProvider) {
      throw new Error('Vector store provider not available');
    }

    // Get optional providers
    this.dbProvider = registry.getByCapabilityFirst('database') as DatabaseProvider;
    this.observabilityProvider = registry.getByCapabilityFirst('observability') as ObservabilityProvider;

    await this.log('info', 'Vector Store Service initialized', {
      serviceId: VectorStoreService.SERVICE_ID,
      version: VectorStoreService.VERSION,
    });
  }

  /**
   * Create a collection
   */
  async createCollection(
    name: string,
    dimension?: number,
    metric?: 'cosine' | 'euclidean' | 'dot-product'
  ): Promise<CollectionInfo> {
    this.ensureInitialized();

    const actualDimension = dimension || this.config.defaultDimension;
    const actualMetric = metric || this.config.defaultMetric;

    await this.vectorProvider!.createCollection(name, actualDimension);

    const collection: CollectionInfo = {
      name,
      dimension: actualDimension,
      metric: actualMetric,
      vectorCount: 0,
      createdAt: new Date(),
    };

    this.collections.set(name, collection);

    await this.log('info', 'Collection created', { name, dimension: actualDimension, metric: actualMetric });

    return collection;
  }

  /**
   * Drop a collection
   */
  async dropCollection(name: string): Promise<void> {
    this.ensureInitialized();

    await this.vectorProvider!.dropCollection(name);
    this.collections.delete(name);

    await this.log('info', 'Collection dropped', { name });
  }

  /**
   * List all collections
   */
  async listCollections(): Promise<CollectionInfo[]> {
    return Array.from(this.collections.values());
  }

  /**
   * Get collection info
   */
  async getCollection(name: string): Promise<CollectionInfo | null> {
    return this.collections.get(name) || null;
  }

  /**
   * Upsert vectors
   */
  async upsertVectors(collection: string, vectors: VectorEntry[]): Promise<void> {
    this.ensureInitialized();

    const collectionInfo = this.collections.get(collection);
    if (!collectionInfo) {
      throw new Error(`Collection not found: ${collection}`);
    }

    await this.vectorProvider!.upsert(
      collection,
      vectors.map(v => ({
        id: v.id,
        values: v.values,
        metadata: v.metadata,
      }))
    );

    // Update collection stats
    collectionInfo.vectorCount += vectors.length;

    await this.log('info', 'Vectors upserted', { collection, count: vectors.length });
  }

  /**
   * Delete vectors
   */
  async deleteVectors(collection: string, ids: string[]): Promise<void> {
    this.ensureInitialized();

    await this.vectorProvider!.delete(collection, ids);

    const collectionInfo = this.collections.get(collection);
    if (collectionInfo) {
      collectionInfo.vectorCount = Math.max(0, collectionInfo.vectorCount - ids.length);
    }

    await this.log('info', 'Vectors deleted', { collection, count: ids.length });
  }

  /**
   * Query similar vectors
   */
  async query(
    collection: string,
    vector: number[],
    topK: number = 10,
    filter?: Record<string, unknown>
  ): Promise<QueryResult[]> {
    this.ensureInitialized();

    const collectionInfo = this.collections.get(collection);
    if (!collectionInfo) {
      throw new Error(`Collection not found: ${collection}`);
    }

    const results = await this.vectorProvider!.query(collection, vector, topK, filter);

    await this.log('debug', 'Query executed', { collection, topK, resultCount: results.length });

    return results.map(r => ({
      id: r.id,
      score: r.score,
      metadata: r.metadata,
    }));
  }

  /**
   * Get service health
   */
  async getHealth(): Promise<ServiceHealth> {
    const providers: Record<string, string> = {};

    // Check vector provider
    if (this.vectorProvider) {
      try {
        const health = await this.vectorProvider.healthCheck();
        providers['vector-store'] = health.status;
      } catch {
        providers['vector-store'] = 'error';
      }
    }

    // Check database provider
    if (this.dbProvider) {
      try {
        const health = await this.dbProvider.healthCheck();
        providers['database'] = health.status;
      } catch {
        providers['database'] = 'error';
      }
    }

    // Check observability provider
    if (this.observabilityProvider) {
      try {
        const health = await this.observabilityProvider.healthCheck();
        providers['observability'] = health.status;
      } catch {
        providers['observability'] = 'error';
      }
    }

    // Determine overall status
    const status = Object.values(providers).includes('unhealthy')
      ? 'unhealthy'
      : Object.values(providers).includes('degraded')
      ? 'degraded'
      : 'healthy';

    // Calculate total vectors
    let totalVectors = 0;
    for (const collection of this.collections.values()) {
      totalVectors += collection.vectorCount;
    }

    return {
      status,
      version: VectorStoreService.VERSION,
      uptime: Date.now() - this.startTime.getTime(),
      providers,
      collections: this.collections.size,
      totalVectors,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.log('info', 'Vector Store Service shutting down');

    if (this.sdk) {
      await this.sdk.shutdown();
    }

    this.vectorProvider = null;
    this.dbProvider = null;
    this.observabilityProvider = null;
    this.sdk = null;
  }

  /**
   * Log a message
   */
  private async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, metadata?: Record<string, unknown>): Promise<void> {
    if (this.observabilityProvider) {
      await this.observabilityProvider.log(level as any, message, {
        service: VectorStoreService.SERVICE_ID,
        ...metadata,
      });
    } else {
      console.log(`[${level.toUpperCase()}] [${VectorStoreService.SERVICE_ID}] ${message}`, metadata || '');
    }
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.sdk || !this.vectorProvider) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create service instance
 */
export function createVectorStoreService(config?: Partial<VectorStoreServiceConfig>): VectorStoreService {
  return new VectorStoreService(config);
}

/**
 * Default export
 */
export default VectorStoreService;