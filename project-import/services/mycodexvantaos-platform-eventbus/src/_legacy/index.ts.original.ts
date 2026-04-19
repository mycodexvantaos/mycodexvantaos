/**
 * CodexvantaOS — event-bus
 * 事件匯流排 — 事件發布/訂閱、路由、過濾
 * 
 * Layer: B-Runtime | Plane: Integration | Tier: 1
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { EventBusService } from './services/event-bus.service.js';
import { EventRouterService } from './services/event-router.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { EventBusService } from './services/event-bus.service.js';
export { EventRouterService } from './services/event-router.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap event-bus
 */
export async function bootstrap(): Promise<void> {
  console.log('[event-bus] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[event-bus] Providers initialized:', Object.keys(providers).join(', '));

  const eventBusService = new EventBusService();
  const eventRouterService = new EventRouterService();

  console.log('[event-bus] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[event-bus] Fatal error:', err);
    process.exit(1);
  });
}
