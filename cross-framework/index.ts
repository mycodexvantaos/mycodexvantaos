/**
 * Cross-Framework Module Index
 * Platform-Independent Provider Pattern Implementation
 * 
 * This module provides a unified API for cross-framework functionality
 * that works in any runtime environment with zero external dependencies.
 * 
 * Runtime Modes:
 * - native: Zero external dependencies, full functionality via local providers
 * - hybrid: External services with fallback to native implementations
 * - connected: External services only, requires network connectivity
 */

// Re-export types for backward compatibility
export type { FrameworkType, AnalysisStatus, FileEntry, AnalysisResult, ZipItem, SynthesisResult } from './zip-synthesis.provider';
export type { CachedAnalysis } from './cache-manager.provider';
export type { LogLevel, LogEntryLegacy } from './logger.provider';
export type { MessageResponse, AnalysisResult as APIAnalysisResult } from './api-client.provider';

// Re-export provider classes
export { ZipSynthesis, createZipSynthesis, detectFrameworkType } from './zip-synthesis.provider';
export { CacheManager, createCacheManager, saveAnalysisCache, getAnalysisCache, clearAnalysisCache, clearAllCache, getCacheStats } from './cache-manager.provider';
export { LoggerProvider, getLogger, createLogger, logger } from './logger.provider';
export { APIClient, createAPIClient } from './api-client.provider';

// Provider factory for dependency injection
export { getProviderFactory, ProviderFactory } from '../packages/capabilities/src/provider-factory';

// Runtime configuration
export { getRuntimeConfig, RuntimeConfig, RuntimeMode } from '../packages/capabilities/src/runtime-config';

/**
 * Initialize all cross-framework modules
 * Call this once at application startup
 */
export async function initializeCrossFramework(config?: {
  runtimeMode?: 'native' | 'hybrid' | 'connected';
  providerFactory?: any;
}): Promise<{
  synthesis: import('./zip-synthesis.provider').ZipSynthesis;
  cache: import('./cache-manager.provider').CacheManager;
  logger: import('./logger.provider').LoggerProvider;
  apiClient: import('./api-client.provider').APIClient;
}> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const { createZipSynthesis } = await import('./zip-synthesis.provider');
  const { createCacheManager } = await import('./cache-manager.provider');
  const { createLogger } = await import('./logger.provider');
  const { createAPIClient } = await import('./api-client.provider');

  const providerFactory = config?.providerFactory || getProviderFactory();

  const [synthesis, cache, logger, apiClient] = await Promise.all([
    createZipSynthesis(providerFactory),
    createCacheManager(providerFactory),
    createLogger(providerFactory),
    createAPIClient(providerFactory),
  ]);

  return { synthesis, cache, logger, apiClient };
}

/**
 * Health check all modules
 */
export async function healthCheckAll(): Promise<{
  synthesis: boolean;
  cache: boolean;
  logger: boolean;
  apiClient: boolean;
  overall: boolean;
}> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const factory = getProviderFactory();

  const results = await Promise.allSettled([
    (await factory.getFrameworkDetectionProvider()).healthCheck(),
    (await factory.getStorageProvider()).healthCheck(),
    (await factory.getLoggingProvider()).healthCheck(),
    (await factory.getCodeSynthesisProvider()).healthCheck(),
  ]);

  const [synthesis, cache, logger, apiClient] = results.map((r, i) => {
    if (r.status === 'fulfilled' && 'healthy' in r.value) {
      return r.value.healthy;
    }
    return false;
  });

  return {
    synthesis,
    cache,
    logger,
    apiClient,
    overall: synthesis && cache && logger && apiClient,
  };
}

/**
 * Shutdown all modules
 */
export async function shutdownAll(): Promise<void> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const factory = getProviderFactory();

  const providers = await Promise.all([
    factory.getFrameworkDetectionProvider(),
    factory.getStorageProvider(),
    factory.getLoggingProvider(),
    factory.getCodeSynthesisProvider(),
  ]);

  await Promise.all(providers.map(p => p.shutdown()));
}