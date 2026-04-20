/**
 * MyCodexVantaOS Filesystem Storage Provider
 * 
 * Native filesystem storage provider implementing the StorageProvider interface
 * Following naming-spec-v1 §8.1: storage-fs
 * 
 * @package @mycodexvantaos/storage-fs
 * @version 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  StorageProvider,
  HealthCheckResult,
  ProviderSource,
  ProviderCriticality,
  ResolvedMode,
} from '@mycodexvantaos/namespaces-sdk';

/**
 * Filesystem storage provider configuration
 */
export interface FileSystemStorageConfig {
  /** Base directory for storage (default: ./data/storage) */
  basePath?: string;
  /** Create base directory if it doesn't exist */
  createBasePath?: boolean;
  /** Maximum file size in bytes (default: 100MB) */
  maxFileSize?: number;
  /** Enable file metadata tracking */
  enableMetadata?: boolean;
}

/**
 * File metadata
 */
export interface FileMetadata {
  key: string;
  size: number;
  createdAt: Date;
  modifiedAt: Date;
  contentType?: string;
  customMetadata?: Record<string, string>;
}

/**
 * Filesystem Storage Provider
 * 
 * Provides native filesystem storage capability for MyCodexVantaOS
 */
export class FileSystemStorageProvider implements StorageProvider {
  readonly capability = 'storage' as const;
  readonly source: ProviderSource = 'native';
  readonly criticality: ProviderCriticality = 'high';
  readonly supportsModes: ResolvedMode[] = ['native', 'hybrid'];

  private config: FileSystemStorageConfig;
  private basePath: string;
  private initialized: boolean = false;
  private metadataStore: Map<string, FileMetadata> = new Map();

  constructor(config: FileSystemStorageConfig = {}) {
    this.config = config;
    this.basePath = config.basePath || path.join(process.cwd(), 'data', 'storage');
  }

  /**
   * Initialize the storage provider
   */
  async initialize(config?: unknown): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Merge configuration
    const finalConfig: FileSystemStorageConfig = {
      ...this.config,
      ...(config as FileSystemStorageConfig || {}),
    };

    this.basePath = finalConfig.basePath || this.basePath;

    // Create base directory if needed
    if (finalConfig.createBasePath !== false) {
      await fs.promises.mkdir(this.basePath, { recursive: true });
    }

    // Verify directory exists and is accessible
    try {
      await fs.promises.access(this.basePath, fs.constants.R_OK | fs.constants.W_OK);
    } catch (error) {
      throw new Error(`Storage base path not accessible: ${this.basePath}`);
    }

    // Load existing metadata if enabled
    if (finalConfig.enableMetadata) {
      await this.loadMetadata();
    }

    this.initialized = true;
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        message: 'Storage provider not initialized',
      };
    }

    try {
      // Test read/write access
      const testFile = path.join(this.basePath, '.health-check');
      await fs.promises.writeFile(testFile, 'health-check');
      await fs.promises.readFile(testFile);
      await fs.promises.unlink(testFile);

      // Get storage stats
      const stats = await this.getStorageStats();

      return {
        status: 'healthy',
        timestamp: new Date(),
        message: 'Filesystem storage is responsive',
        details: {
          basePath: this.basePath,
          fileCount: stats.fileCount,
          totalSize: stats.totalSize,
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
   * Store data at a key
   */
  async put(key: string, data: Buffer | string): Promise<void> {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);

    // Create directory if needed
    await fs.promises.mkdir(dir, { recursive: true });

    // Check file size limit
    const dataSize = Buffer.byteLength(data);
    if (this.config.maxFileSize && dataSize > this.config.maxFileSize) {
      throw new Error(`File size ${dataSize} exceeds limit ${this.config.maxFileSize}`);
    }

    // Write file
    await fs.promises.writeFile(filePath, data);

    // Update metadata
    if (this.config.enableMetadata !== false) {
      const stat = await fs.promises.stat(filePath);
      this.metadataStore.set(key, {
        key,
        size: stat.size,
        createdAt: this.metadataStore.get(key)?.createdAt || stat.birthtime,
        modifiedAt: stat.mtime,
      });
    }
  }

  /**
   * Retrieve data from a key
   */
  async get(key: string): Promise<Buffer | null> {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);

    try {
      return await fs.promises.readFile(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Delete data at a key
   */
  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);

    try {
      await fs.promises.unlink(filePath);
      this.metadataStore.delete(key);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all keys with optional prefix
   */
  async list(prefix?: string): Promise<string[]> {
    this.ensureInitialized();

    const keys: string[] = [];
    const searchPath = prefix ? this.resolvePath(prefix) : this.basePath;

    const walk = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(this.basePath, fullPath);
          const key = relativePath.split(path.sep).join('/');
          
          if (!prefix || key.startsWith(prefix)) {
            keys.push(key);
          }
        }
      }
    };

    try {
      await walk(searchPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    return keys;
  }

  /**
   * Get file metadata
   */
  async getMetadata(key: string): Promise<FileMetadata | null> {
    this.ensureInitialized();
    this.validateKey(key);

    // Check cache first
    if (this.metadataStore.has(key)) {
      return this.metadataStore.get(key) || null;
    }

    const filePath = this.resolvePath(key);

    try {
      const stat = await fs.promises.stat(filePath);
      return {
        key,
        size: stat.size,
        createdAt: stat.birthtime,
        modifiedAt: stat.mtime,
      };
    } catch {
      return null;
    }
  }

  /**
   * Copy a file to another key
   */
  async copy(sourceKey: string, destKey: string): Promise<void> {
    const data = await this.get(sourceKey);
    if (data === null) {
      throw new Error(`Source key not found: ${sourceKey}`);
    }
    await this.put(destKey, data);
  }

  /**
   * Move a file to another key
   */
  async move(sourceKey: string, destKey: string): Promise<void> {
    await this.copy(sourceKey, destKey);
    await this.delete(sourceKey);
  }

  /**
   * Get a readable stream for a file
   */
  createReadStream(key: string): fs.ReadStream {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);
    return fs.createReadStream(filePath);
  }

  /**
   * Get a writable stream for a file
   */
  createWriteStream(key: string): fs.WriteStream {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);

    // Create directory synchronously (stream will need it immediately)
    fs.mkdirSync(dir, { recursive: true });

    return fs.createWriteStream(filePath);
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    fileCount: number;
    totalSize: number;
    basePath: string;
  }> {
    this.ensureInitialized();

    let fileCount = 0;
    let totalSize = 0;

    const walk = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          fileCount++;
          const stat = await fs.promises.stat(fullPath);
          totalSize += stat.size;
        }
      }
    };

    try {
      await walk(this.basePath);
    } catch {
      // Directory might not exist yet
    }

    return {
      fileCount,
      totalSize,
      basePath: this.basePath,
    };
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    this.ensureInitialized();

    const keys = await this.list();
    await Promise.all(keys.map(key => this.delete(key)));
    this.metadataStore.clear();
  }

  /**
   * Shutdown the provider
   */
  async shutdown(): Promise<void> {
    if (this.config.enableMetadata !== false) {
      await this.saveMetadata();
    }
    this.initialized = false;
  }

  /**
   * Resolve a key to a file path
   */
  private resolvePath(key: string): string {
    // Normalize key to prevent path traversal
    const normalized = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.basePath, normalized);
  }

  /**
   * Validate a key
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string');
    }

    if (key.includes('..')) {
      throw new Error('Key cannot contain path traversal sequences');
    }

    if (key.startsWith('/')) {
      throw new Error('Key cannot start with a slash');
    }
  }

  /**
   * Load metadata from disk
   */
  private async loadMetadata(): Promise<void> {
    const metadataPath = path.join(this.basePath, '.metadata.json');
    
    try {
      const data = await fs.promises.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(data);
      
      for (const [key, value] of Object.entries(metadata)) {
        this.metadataStore.set(key, value as FileMetadata);
      }
    } catch {
      // Metadata file doesn't exist yet
    }
  }

  /**
   * Save metadata to disk
   */
  private async saveMetadata(): Promise<void> {
    const metadataPath = path.join(this.basePath, '.metadata.json');
    const metadata = Object.fromEntries(this.metadataStore);
    
    await fs.promises.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  /**
   * Ensure provider is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Storage provider not initialized. Call initialize() first.');
    }
  }
}

/**
 * Export provider instance for easy registration
 */
export function createFileSystemStorageProvider(config?: FileSystemStorageConfig): FileSystemStorageProvider {
  return new FileSystemStorageProvider(config);
}

/**
 * Default export
 */
export default FileSystemStorageProvider;