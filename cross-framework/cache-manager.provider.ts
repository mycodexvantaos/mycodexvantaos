/**
 * Cache Manager - Provider Pattern Version
 * Transformed to use StorageCapability for platform independence
 * 
 * Supports:
 * - Native: In-memory or localStorage storage (no dependencies)
 * - Hybrid: AsyncStorage with fallback to memory
 * - Connected: External cache services (Redis, etc.)
 */

import type { StorageCapability, StorageItem } from '../packages/capabilities/src/storage';

export interface CachedAnalysis {
  data: any; // AnalysisResult
  timestamp: number;
  expiresAt: number;
}

const CACHE_PREFIX = 'zip_synthesis_';
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Cache Manager using Provider Pattern
 */
export class CacheManager {
  private storage: StorageCapability | null = null;
  private initialized = false;

  constructor(private providerFactory: any) {}

  /**
   * Initialize the cache manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.storage = await this.providerFactory.getStorageProvider();
      await this.storage.initialize();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize CacheManager:', error);
      throw error;
    }
  }

  /**
   * Generate cache key
   */
  getCacheKey(zipName: string, fileCount: number): string {
    const hash = `${zipName}_${fileCount}`.replace(/[^a-zA-Z0-9]/g, '_');
    return `${CACHE_PREFIX}${hash}`;
  }

  /**
   * Save analysis result to cache
   */
  async saveAnalysisCache(
    zipName: string,
    fileCount: number,
    analysis: any
  ): Promise<void> {
    this.ensureInitialized();

    try {
      const key = this.getCacheKey(zipName, fileCount);
      const cached: CachedAnalysis = {
        data: analysis,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_EXPIRY_MS,
      };

      await this.storage!.set(key, JSON.stringify(cached), {
        ttl: CACHE_EXPIRY_MS,
        tags: ['analysis', 'cache'],
      });
    } catch (error) {
      console.error('Error saving analysis cache:', error);
    }
  }

  /**
   * Get analysis result from cache
   */
  async getAnalysisCache(
    zipName: string,
    fileCount: number
  ): Promise<any | null> {
    this.ensureInitialized();

    try {
      const key = this.getCacheKey(zipName, fileCount);
      const item = await this.storage!.get(key);

      if (!item || !item.value) return null;

      const cached: CachedAnalysis = JSON.parse(item.value as string);

      // Check if expired
      if (Date.now() > cached.expiresAt) {
        await this.storage!.delete(key);
        return null;
      }

      return cached.data;
    } catch (error) {
      console.error('Error reading analysis cache:', error);
      return null;
    }
  }

  /**
   * Clear specific cache
   */
  async clearAnalysisCache(zipName: string, fileCount: number): Promise<void> {
    this.ensureInitialized();

    try {
      const key = this.getCacheKey(zipName, fileCount);
      await this.storage!.delete(key);
    } catch (error) {
      console.error('Error clearing analysis cache:', error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAllCache(): Promise<void> {
    this.ensureInitialized();

    try {
      const keys = await this.storage!.keys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      
      for (const key of cacheKeys) {
        await this.storage!.delete(key);
      }
    } catch (error) {
      console.error('Error clearing all cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ count: number; size: number }> {
    this.ensureInitialized();

    try {
      const keys = await this.storage!.keys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));

      let totalSize = 0;
      for (const key of cacheKeys) {
        const item = await this.storage!.get(key);
        if (item && item.value) {
          totalSize += (item.value as string).length;
        }
      }

      return {
        count: cacheKeys.length,
        size: totalSize,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return { count: 0, size: 0 };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.storage) return false;
    
    try {
      const result = await this.storage.healthCheck();
      return result.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.storage) {
      await this.storage.shutdown();
    }
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.storage) {
      throw new Error('CacheManager not initialized. Call initialize() first.');
    }
  }
}

/**
 * Factory function to create CacheManager instance
 */
export async function createCacheManager(providerFactory: any): Promise<CacheManager> {
  const manager = new CacheManager(providerFactory);
  await manager.initialize();
  return manager;
}

/**
 * Legacy-compatible exports for backward compatibility
 * These functions maintain the original API but use the provider internally
 */
let _cacheManagerInstance: CacheManager | null = null;

async function getCacheManager(): Promise<CacheManager> {
  if (!_cacheManagerInstance) {
    const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
    const factory = getProviderFactory();
    _cacheManagerInstance = await createCacheManager(factory);
  }
  return _cacheManagerInstance;
}

/**
 * Legacy function: Save analysis cache
 * Maintains backward compatibility with original cache-manager.ts
 */
export async function saveAnalysisCache(
  zipName: string,
  fileCount: number,
  analysis: any
): Promise<void> {
  const manager = await getCacheManager();
  return manager.saveAnalysisCache(zipName, fileCount, analysis);
}

/**
 * Legacy function: Get analysis cache
 */
export async function getAnalysisCache(
  zipName: string,
  fileCount: number
): Promise<any | null> {
  const manager = await getCacheManager();
  return manager.getAnalysisCache(zipName, fileCount);
}

/**
 * Legacy function: Clear analysis cache
 */
export async function clearAnalysisCache(zipName: string, fileCount: number): Promise<void> {
  const manager = await getCacheManager();
  return manager.clearAnalysisCache(zipName, fileCount);
}

/**
 * Legacy function: Clear all cache
 */
export async function clearAllCache(): Promise<void> {
  const manager = await getCacheManager();
  return manager.clearAllCache();
}

/**
 * Legacy function: Get cache stats
 */
export async function getCacheStats(): Promise<{ count: number; size: number }> {
  const manager = await getCacheManager();
  return manager.getCacheStats();
}