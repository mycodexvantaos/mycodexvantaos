/**
 * CodexvantaOS — infra-gitops
 * GitOps 部署 — 聲明式部署、漂移偵測
 * 
 * Layer: E-DeployTarget | Plane: Control | Tier: 2
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { GitOpsService } from './services/gitops.service.js';
import { DriftDetectionService } from './services/drift-detection.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { GitOpsService } from './services/gitops.service.js';
export { DriftDetectionService } from './services/drift-detection.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap infra-gitops
 */
export async function bootstrap(): Promise<void> {
  console.log('[infra-gitops] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[infra-gitops] Providers initialized:', Object.keys(providers).join(', '));

  const gitOpsService = new GitOpsService();
  const driftDetectionService = new DriftDetectionService();

  console.log('[infra-gitops] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[infra-gitops] Fatal error:', err);
    process.exit(1);
  });
}
