/**
 * CodexvantaOS — network-mesh
 * 服務網格 — 服務發現、負載均衡、API 閘道
 * 
 * Layer: B-Runtime | Plane: Integration | Tier: 2
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { ServiceDiscoveryService } from './services/service-discovery.service.js';
import { LoadBalancerService } from './services/load-balancer.service.js';
import { GatewayService } from './services/gateway.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { ServiceDiscoveryService } from './services/service-discovery.service.js';
export { LoadBalancerService } from './services/load-balancer.service.js';
export { GatewayService } from './services/gateway.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap network-mesh
 */
export async function bootstrap(): Promise<void> {
  console.log('[network-mesh] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[network-mesh] Providers initialized:', Object.keys(providers).join(', '));

  const serviceDiscoveryService = new ServiceDiscoveryService();
  const loadBalancerService = new LoadBalancerService();
  const gatewayService = new GatewayService();

  console.log('[network-mesh] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[network-mesh] Fatal error:', err);
    process.exit(1);
  });
}
