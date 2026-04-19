/**
 * StorageProvider Interface
 *
 * Abstraction for object/file storage operations.
 * Platform MUST provide a native implementation (local filesystem).
 * External providers (S3, R2, GCS) are optional connectors.
 *
 * @layer Layer C (Native Services) + Layer D (Connector)
 */

export interface StorageObjectMeta {
  key: string;
  size: number;
  contentType?: string;
  lastModified?: Date;
  etag?: string;
  metadata?: Record<string, string>;
}

export interface StorageHealth {
  available: boolean;
  provider: string;
  usedBytes?: number;
  totalBytes?: number;
}

export interface StorageListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface StorageListResult {
  objects: StorageObjectMeta[];
  cursor?: string;
  hasMore: boolean;
}

export interface StorageProvider {
  /** Unique provider identifier */
  readonly providerId: string;

  /** Provider mode: 'native' | 'external' */
  readonly mode: 'native' | 'external';

  /** Initialize storage backend */
  init(): Promise<void>;

  /** Store an object */
  put(
    key: string,
    data: Buffer | Uint8Array | string,
    meta?: { contentType?: string; metadata?: Record<string, string> }
  ): Promise<StorageObjectMeta>;

  /** Retrieve an object */
  get(key: string): Promise<{ data: Uint8Array; meta: StorageObjectMeta }>;

  /** Delete an object */
  delete(key: string): Promise<void>;

  /** Check if object exists */
  exists(key: string): Promise<boolean>;

  /** List objects */
  list(options?: StorageListOptions): Promise<StorageListResult>;

  /** Get object metadata without downloading */
  head(key: string): Promise<StorageObjectMeta | null>;

  /** Generate a signed/temporary URL (optional, not all providers support) */
  signedUrl?(key: string, expiresInSec?: number): Promise<string>;

  /** Copy an object */
  copy?(sourceKey: string, destKey: string): Promise<StorageObjectMeta>;

  /** Health check */
  healthcheck(): Promise<StorageHealth>;

  /** Graceful shutdown */
  close(): Promise<void>;
}