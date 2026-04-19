/**
 * CodexvantaOS — scheduler
 * 排程器 — 任務排程、Cron、延遲執行
 * 
 * Layer: B-Runtime | Plane: Execution | Tier: 2
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { SchedulerService } from './services/scheduler.service.js';
import { CronService } from './services/cron.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { SchedulerService } from './services/scheduler.service.js';
export { CronService } from './services/cron.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap scheduler
 */
export async function bootstrap(): Promise<void> {
  console.log('[scheduler] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[scheduler] Providers initialized:', Object.keys(providers).join(', '));

  const schedulerService = new SchedulerService();
  const cronService = new CronService();

  console.log('[scheduler] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[scheduler] Fatal error:', err);
    process.exit(1);
  });
}
