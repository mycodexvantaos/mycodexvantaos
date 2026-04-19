/**
 * CodexvantaOS — infra-base
 * 基礎設施層 — 環境佈建、基礎架構管理
 * 
 * Layer: E-DeployTarget | Plane: Control | Tier: 1
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { ProvisioningService } from './services/provisioning.service.js';
import { EnvironmentService } from './services/environment.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { ProvisioningService } from './services/provisioning.service.js';
export { EnvironmentService } from './services/environment.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap infra-base
 */
export async function bootstrap(): Promise<void> {
  console.log('[infra-base] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[infra-base] Providers initialized:', Object.keys(providers).join(', '));

  const provisioningService = new ProvisioningService();
  const environmentService = new EnvironmentService();

  console.log('[infra-base] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[infra-base] Fatal error:', err);
    process.exit(1);
  });
}
