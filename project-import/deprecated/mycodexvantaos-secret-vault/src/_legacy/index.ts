/**
 * CodexvantaOS — secret-vault
 * 密鑰金庫 — 密鑰管理、加密、輪替
 * 
 * Layer: C-NativeServices | Plane: Control | Tier: 1
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { VaultService } from './services/vault.service.js';
import { EncryptionService } from './services/encryption.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { VaultService } from './services/vault.service.js';
export { EncryptionService } from './services/encryption.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap secret-vault
 */
export async function bootstrap(): Promise<void> {
  console.log('[secret-vault] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[secret-vault] Providers initialized:', Object.keys(providers).join(', '));

  const vaultService = new VaultService();
  const encryptionService = new EncryptionService();

  console.log('[secret-vault] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[secret-vault] Fatal error:', err);
    process.exit(1);
  });
}
