/**
 * CodexvantaOS — observability-stack Provider Initialization
 * Philosophy: Native-first / Provider-agnostic
 * 
 * This module initializes the required providers using ProviderRegistry.
 * In Native mode: all providers use built-in implementations.
 * In Connected mode: providers use external services.
 * In Hybrid mode: mix based on available configuration.
 */

import { ProviderRegistry } from '@codexvanta/core-kernel';

// Provider type imports
import type { ObservabilityProvider, DatabaseProvider, NotificationProvider } from '@codexvanta/core-kernel';

export interface Providers {
  observability: ObservabilityProvider;
  database: DatabaseProvider;
  notification: NotificationProvider;
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
    observability: await registry.resolve<ObservabilityProvider>('observability'),
    database: await registry.resolve<DatabaseProvider>('database'),
    notification: await registry.resolve<NotificationProvider>('notification'),
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
