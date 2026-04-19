/**
 * CodexvantaOS — fleet-sandbox
 * 沙盒管理 — 沙盒建立、隔離、容器管理
 * 
 * Layer: B-Runtime | Plane: Sandbox | Tier: 3
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { SandboxService } from './services/sandbox.service.js';
import { IsolationService } from './services/isolation.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { SandboxService } from './services/sandbox.service.js';
export { IsolationService } from './services/isolation.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap fleet-sandbox
 */
export async function bootstrap(): Promise<void> {
  console.log('[fleet-sandbox] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[fleet-sandbox] Providers initialized:', Object.keys(providers).join(', '));

  const sandboxService = new SandboxService();
  const isolationService = new IsolationService();

  console.log('[fleet-sandbox] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[fleet-sandbox] Fatal error:', err);
    process.exit(1);
  });
}
