/**
 * CodexvantaOS — core-code-deconstructor Provider Initialization
 * Philosophy: Native-first / Provider-agnostic
 * 
 * This module initializes the required providers using ProviderRegistry.
 * In Native mode: all providers use built-in implementations.
 * In Connected mode: providers use external services.
 * In Hybrid mode: mix based on available configuration.
 */

import { ProviderRegistry } from '@codexvanta/core-kernel';

// Provider type imports
import type { DatabaseProvider, StorageProvider } from '@codexvanta/core-kernel';

export interface Providers {
  database: DatabaseProvider;
  storage: StorageProvider;
}

let _providers: Providers | null = null;

/**
 * Initialize all required providers via ProviderRegistry.
 * Auto-detects Native/Connected/Hybrid mode based on environment.
 */
export async function initProviders(): Promise<Providers> {
  if (_providers) return _providers;

  const registry = new ProviderRegistry();
  await registry.initialize();

  _providers = {
    database: await registry.resolve<DatabaseProvider>('database'),
    storage: await registry.resolve<StorageProvider>('storage'),
  };

  return _providers;
}

/**
 * Get initialized providers. Throws if not yet initialized.
 */
export function getProviders(): Providers {
  if (!_providers) {
    throw new Error('Providers not initialized. Call initProviders() first.');
  }
  return _providers;
}

/**
 * Shutdown all providers gracefully.
 */
export async function shutdownProviders(): Promise<void> {
  _providers = null;
}
