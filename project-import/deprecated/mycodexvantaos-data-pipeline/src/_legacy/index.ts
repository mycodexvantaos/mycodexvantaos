/**
 * CodexvantaOS — data-pipeline
 * 資料管線 — 資料攝取、轉換、匯出
 * 
 * Layer: B-Runtime | Plane: Data | Tier: 2
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { IngestionService } from './services/ingestion.service.js';
import { TransformationService } from './services/transformation.service.js';
import { ExportService } from './services/export.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { IngestionService } from './services/ingestion.service.js';
export { TransformationService } from './services/transformation.service.js';
export { ExportService } from './services/export.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap data-pipeline
 */
export async function bootstrap(): Promise<void> {
  console.log('[data-pipeline] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[data-pipeline] Providers initialized:', Object.keys(providers).join(', '));

  const ingestionService = new IngestionService();
  const transformationService = new TransformationService();
  const exportService = new ExportService();

  console.log('[data-pipeline] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[data-pipeline] Fatal error:', err);
    process.exit(1);
  });
}
