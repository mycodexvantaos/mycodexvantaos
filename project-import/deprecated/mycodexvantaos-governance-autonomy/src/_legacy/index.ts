/**
 * CodexvantaOS — governance-autonomy
 * 自治治理 — 合規監控、自動修復、自主治理
 * 
 * Layer: B-Runtime | Plane: Governance | Tier: 4
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { ComplianceService } from './services/compliance.service.js';
import { RemediationService } from './services/remediation.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { ComplianceService } from './services/compliance.service.js';
export { RemediationService } from './services/remediation.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap governance-autonomy
 */
export async function bootstrap(): Promise<void> {
  console.log('[governance-autonomy] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[governance-autonomy] Providers initialized:', Object.keys(providers).join(', '));

  const complianceService = new ComplianceService();
  const remediationService = new RemediationService();

  console.log('[governance-autonomy] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[governance-autonomy] Fatal error:', err);
    process.exit(1);
  });
}
