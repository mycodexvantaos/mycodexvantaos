/**
 * NativeStorageProvider — Filesystem-based implementation
 * 
 * Zero external dependencies. Stores objects as files on the local filesystem.
 * 
 * Features:
 *  - Local directory-based object storage
 *  - Metadata stored as sidecar JSON files
 *  - Content-addressable integrity via checksums
 *  - Supports listing, pagination, and prefix filtering
 *  - No S3, no GCS, no cloud dependency
 */

import type {
  StorageProvider,
  StorageObjectMeta,
  StorageListResult,
  StorageListOptions,
  StorageHealth,
} from '../../interfaces/storage';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface NativeStorageConfig {
  /** Root directory for stored objects. */
  basePath?: string;
  /** Max file size in bytes (default 100MB). */
  maxFileSize?: number;
}

export class NativeStorageProvider implements StorageProvider {
  readonly providerId = 'native-filesystem';
  readonly mode = 'native' as const;

  private config: Required<NativeStorageConfig>;

  constructor(config?: NativeStorageConfig) {
    this.config = {
      basePath: config?.basePath ?? path.join(process.cwd(), '.codexvanta', 'storage'),
      maxFileSize: config?.maxFileSize ?? 100 * 1024 * 1024,
    };
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.config.basePath)) {
      fs.mkdirSync(this.config.basePath, { recursive: true });
    }
    // Create metadata directory
    const metaDir = path.join(this.config.basePath, '.meta');
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true });
    }
  }

  async put(
    key: string,
    data: Buffer | Uint8Array | string,
    meta?: { contentType?: string; metadata?: Record<string, string> }
  ): Promise<StorageObjectMeta> {
    const filePath = this.keyToPath(key);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : Buffer.from(data);

    if (buffer.length > this.config.maxFileSize) {
      throw new Error(`File exceeds max size: ${buffer.length} > ${this.config.maxFileSize}`);
    }

    fs.writeFileSync(filePath, buffer);

    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const now = Date.now();

    const objectMeta: StorageObjectMeta = {
      key,
      size: buffer.length,
      contentType: meta?.contentType ?? 'application/octet-stream',
      checksum,
      lastModified: now,
      metadata: meta?.metadata,
    };

    // Write sidecar metadata
    this.writeMetadata(key, objectMeta);

    return objectMeta;
  }

  async get(key: string): Promise<{ data: Uint8Array; meta: StorageObjectMeta }> {
    const filePath = this.keyToPath(key);

    if (!fs.existsSync(filePath)) {
      throw new Error(`Object not found: ${key}`);
    }

    const data = fs.readFileSync(filePath);
    const meta = this.readMetadata(key) ?? this.buildMetaFromFile(key, filePath, data);

    return { data: new Uint8Array(data), meta };
  }

  async delete(key: string): Promise<void> {
    const filePath = this.keyToPath(key);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    const metaPath = this.metaPath(key);
    if (fs.existsSync(metaPath)) {
      fs.unlinkSync(metaPath);
    }
  }

  async exists(key: string): Promise<boolean> {
    return fs.existsSync(this.keyToPath(key));
  }

  async list(options?: StorageListOptions): Promise<StorageListResult> {
    const prefix = options?.prefix ?? '';
    const limit = options?.maxResults ?? 1000;
    const startAfter = options?.cursor;

    const allKeys = this.walkKeys(this.config.basePath, '')
      .filter(k => k.startsWith(prefix) && !k.startsWith('.meta/'))
      .sort();

    let startIdx = 0;
    if (startAfter) {
      const idx = allKeys.indexOf(startAfter);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }

    const pageKeys = allKeys.slice(startIdx, startIdx + limit);
    const objects: StorageObjectMeta[] = pageKeys.map(key => {
      const meta = this.readMetadata(key);
      if (meta) return meta;
      const filePath = this.keyToPath(key);
      const stat = fs.statSync(filePath);
      return {
        key,
        size: stat.size,
        contentType: 'application/octet-stream',
        lastModified: stat.mtimeMs,
      };
    });

    const hasMore = startIdx + limit < allKeys.length;

    return {
      objects,
      nextCursor: hasMore ? pageKeys[pageKeys.length - 1] : undefined,
      truncated: hasMore,
    };
  }

  async head(key: string): Promise<StorageObjectMeta | null> {
    const filePath = this.keyToPath(key);
    if (!fs.existsSync(filePath)) return null;

    const meta = this.readMetadata(key);
    if (meta) return meta;

    const stat = fs.statSync(filePath);
    return {
      key,
      size: stat.size,
      contentType: 'application/octet-stream',
      lastModified: stat.mtimeMs,
    };
  }

  async healthcheck(): Promise<StorageHealth> {
    try {
      // Test write/read/delete cycle
      const testKey = `.healthcheck-${Date.now()}`;
      await this.put(testKey, 'ok');
      await this.get(testKey);
      await this.delete(testKey);

      // Count total objects
      const allKeys = this.walkKeys(this.config.basePath, '')
        .filter(k => !k.startsWith('.meta/') && !k.startsWith('.healthcheck'));

      return {
        healthy: true,
        mode: 'native',
        provider: this.providerId,
        objectCount: allKeys.length,
        details: { basePath: this.config.basePath },
      };
    } catch (err) {
      return {
        healthy: false,
        mode: 'native',
        provider: this.providerId,
        details: { error: String(err) },
      };
    }
  }

  async close(): Promise<void> {
    // No connections to close for filesystem storage
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private keyToPath(key: string): string {
    // Sanitize key to prevent directory traversal
    const sanitized = key.replace(/\.\./g, '_').replace(/^\//, '');
    return path.join(this.config.basePath, sanitized);
  }

  private metaPath(key: string): string {
    const sanitized = key.replace(/\.\./g, '_').replace(/^\//, '').replace(/\//g, '__');
    return path.join(this.config.basePath, '.meta', `${sanitized}.json`);
  }

  private writeMetadata(key: string, meta: StorageObjectMeta): void {
    const metaDir = path.join(this.config.basePath, '.meta');
    if (!fs.existsSync(metaDir)) {
      fs.mkdirSync(metaDir, { recursive: true });
    }
    fs.writeFileSync(this.metaPath(key), JSON.stringify(meta, null, 2));
  }

  private readMetadata(key: string): StorageObjectMeta | null {
    const mp = this.metaPath(key);
    if (!fs.existsSync(mp)) return null;
    try {
      return JSON.parse(fs.readFileSync(mp, 'utf-8'));
    } catch {
      return null;
    }
  }

  private buildMetaFromFile(key: string, filePath: string, data: Buffer): StorageObjectMeta {
    const stat = fs.statSync(filePath);
    return {
      key,
      size: stat.size,
      contentType: 'application/octet-stream',
      checksum: crypto.createHash('sha256').update(data).digest('hex'),
      lastModified: stat.mtimeMs,
    };
  }

  private walkKeys(dir: string, prefix: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results.push(...this.walkKeys(path.join(dir, entry.name), key));
      } else {
        results.push(key);
      }
    }
    return results;
  }
}