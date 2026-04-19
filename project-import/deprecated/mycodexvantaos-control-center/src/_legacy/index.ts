/**
 * CodexvantaOS — control-center
 * 控制中心 — 多倉庫協調、Registry 管理、狀態追蹤
 * 
 * Layer: B-Runtime | Plane: Control | Tier: 1
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { OrchestrationService } from './services/orchestration.service.js';
import { RegistryService } from './services/registry.service.js';
import { StateTrackingService } from './services/state-tracking.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { OrchestrationService } from './services/orchestration.service.js';
export { RegistryService } from './services/registry.service.js';
export { StateTrackingService } from './services/state-tracking.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap control-center
 */
export async function bootstrap(): Promise<void> {
  console.log('[control-center] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[control-center] Providers initialized:', Object.keys(providers).join(', '));

  const orchestrationService = new OrchestrationService();
  const registryService = new RegistryService();
  const stateTrackingService = new StateTrackingService();

  console.log('[control-center] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[control-center] Fatal error:', err);
    process.exit(1);
  });
}
