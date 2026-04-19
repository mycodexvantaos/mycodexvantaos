/**
 * CodexvantaOS — policy-engine
 * 策略引擎 — 策略定義、驗證、執行
 * 
 * Layer: B-Runtime | Plane: Governance | Tier: 2
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { PolicyService } from './services/policy.service.js';
import { PolicyEnforcerService } from './services/policy-enforcer.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { PolicyService } from './services/policy.service.js';
export { PolicyEnforcerService } from './services/policy-enforcer.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap policy-engine
 */
export async function bootstrap(): Promise<void> {
  console.log('[policy-engine] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[policy-engine] Providers initialized:', Object.keys(providers).join(', '));

  const policyService = new PolicyService();
  const policyEnforcerService = new PolicyEnforcerService();

  console.log('[policy-engine] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[policy-engine] Fatal error:', err);
    process.exit(1);
  });
}
