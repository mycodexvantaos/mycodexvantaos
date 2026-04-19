/**
 * CodexvantaOS — core-code-deconstructor
 * 程式碼解構器 — AST 分析、依賴圖、程式碼理解
 * 
 * Layer: A-Builder | Plane: Execution | Tier: 4
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { ASTAnalyzerService } from './services/ast-analyzer.service.js';
import { DependencyGraphService } from './services/dependency-graph.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { ASTAnalyzerService } from './services/ast-analyzer.service.js';
export { DependencyGraphService } from './services/dependency-graph.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap core-code-deconstructor
 */
export async function bootstrap(): Promise<void> {
  console.log('[core-code-deconstructor] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[core-code-deconstructor] Providers initialized:', Object.keys(providers).join(', '));

  const aSTAnalyzerService = new ASTAnalyzerService();
  const dependencyGraphService = new DependencyGraphService();

  console.log('[core-code-deconstructor] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[core-code-deconstructor] Fatal error:', err);
    process.exit(1);
  });
}
