/**
 * CodexvantaOS — decision-engine
 * 決策引擎 — 規則評估、條件路由、策略執行
 * 
 * Layer: B-Runtime | Plane: Decision | Tier: 3
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { RuleEngineService } from './services/rule-engine.service.js';
import { RoutingService } from './services/routing.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { RuleEngineService } from './services/rule-engine.service.js';
export { RoutingService } from './services/routing.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap decision-engine
 */
export async function bootstrap(): Promise<void> {
  console.log('[decision-engine] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[decision-engine] Providers initialized:', Object.keys(providers).join(', '));

  const ruleEngineService = new RuleEngineService();
  const routingService = new RoutingService();

  console.log('[decision-engine] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[decision-engine] Fatal error:', err);
    process.exit(1);
  });
}
