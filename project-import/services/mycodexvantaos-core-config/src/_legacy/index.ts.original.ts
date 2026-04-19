/**
 * CodexvantaOS — config-manager
 * 配置管理服務 — 配置讀寫、Feature Flags、環境管理
 * 
 * Layer: C-NativeServices | Plane: Control | Tier: 1
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { ConfigService } from './services/config.service.js';
import { FeatureFlagService } from './services/feature-flag.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { ConfigService } from './services/config.service.js';
export { FeatureFlagService } from './services/feature-flag.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap config-manager
 */
export async function bootstrap(): Promise<void> {
  console.log('[config-manager] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[config-manager] Providers initialized:', Object.keys(providers).join(', '));

  const configService = new ConfigService();
  const featureFlagService = new FeatureFlagService();

  console.log('[config-manager] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[config-manager] Fatal error:', err);
    process.exit(1);
  });
}
