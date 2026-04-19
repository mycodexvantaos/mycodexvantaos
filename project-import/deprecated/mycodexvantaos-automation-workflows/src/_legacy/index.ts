/**
 * CodexvantaOS — workflows
 * CI/CD 連接器 — 管線整合、觸發器、工作流自動化
 * 
 * Layer: D-Connector | Plane: Execution | Tier: 3
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { PipelineService } from './services/pipeline.service.js';
import { TriggerService } from './services/trigger.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { PipelineService } from './services/pipeline.service.js';
export { TriggerService } from './services/trigger.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap workflows
 */
export async function bootstrap(): Promise<void> {
  console.log('[workflows] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[workflows] Providers initialized:', Object.keys(providers).join(', '));

  const pipelineService = new PipelineService();
  const triggerService = new TriggerService();

  console.log('[workflows] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[workflows] Fatal error:', err);
    process.exit(1);
  });
}
