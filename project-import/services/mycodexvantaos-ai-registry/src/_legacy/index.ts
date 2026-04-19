/**
 * CodexvantaOS — module-suite
 * 模組套件 — 模組載入、外掛管理、擴充註冊
 * 
 * Layer: A-Builder | Plane: Execution | Tier: 2
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { ModuleLoaderService } from './services/module-loader.service.js';
import { PluginManagerService } from './services/plugin-manager.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { ModuleLoaderService } from './services/module-loader.service.js';
export { PluginManagerService } from './services/plugin-manager.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap module-suite
 */
export async function bootstrap(): Promise<void> {
  console.log('[module-suite] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[module-suite] Providers initialized:', Object.keys(providers).join(', '));

  const moduleLoaderService = new ModuleLoaderService();
  const pluginManagerService = new PluginManagerService();

  console.log('[module-suite] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[module-suite] Fatal error:', err);
    process.exit(1);
  });
}
