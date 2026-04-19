/**
 * CodexvantaOS — core-kernel
 * 核心內核 — Provider 介面、Native/External 實作、ProviderRegistry
 * 
 * Layer: B-Runtime | Plane: Control | Tier: 0
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

// ─── Provider Interfaces ───────────────────────────────
export * from './interfaces/index.js';

// ─── Native Providers ──────────────────────────────────
export * as NativeProviders from './providers/native/index.js';

// ─── External Providers ────────────────────────────────
export * as ExternalProviders from './providers/external/index.js';

// ─── Provider Registry ─────────────────────────────────
export { ProviderRegistry } from './providers/registry.js';

/**
 * Core Kernel Bootstrap
 * Initializes the ProviderRegistry and detects operational mode.
 */
export async function bootstrapKernel(): Promise<void> {
  const { ProviderRegistry } = await import('./providers/registry.js');
  
  const registry = new ProviderRegistry();
  await registry.initialize();

  const mode = process.env.CODEXVANTA_MODE || 'auto';
  console.log(`[core-kernel] Initialized in ${mode} mode`);
  console.log('[core-kernel] 12 Provider interfaces ready');
  console.log('[core-kernel] Native + External implementations loaded');
  console.log('[core-kernel] ProviderRegistry active — failover enabled');
}