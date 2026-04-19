/**
 * CodexvantaOS — observability-stack
 * 可觀測性堆疊 — 日誌、指標、追蹤、告警、儀表板
 * 
 * Layer: C-NativeServices | Plane: Observability | Tier: 1
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { LoggingService } from './services/logging.service.js';
import { MetricsService } from './services/metrics.service.js';
import { TracingService } from './services/tracing.service.js';
import { AlertingService } from './services/alerting.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { LoggingService } from './services/logging.service.js';
export { MetricsService } from './services/metrics.service.js';
export { TracingService } from './services/tracing.service.js';
export { AlertingService } from './services/alerting.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap observability-stack
 */
export async function bootstrap(): Promise<void> {
  console.log('[observability-stack] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[observability-stack] Providers initialized:', Object.keys(providers).join(', '));

  const loggingService = new LoggingService();
  const metricsService = new MetricsService();
  const tracingService = new TracingService();
  const alertingService = new AlertingService();

  console.log('[observability-stack] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[observability-stack] Fatal error:', err);
    process.exit(1);
  });
}
