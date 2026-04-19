/**
 * CodexvantaOS — ai-engine
 * AI 引擎 — LLM 推理、Agent 執行、Embedding、RAG
 * 
 * Layer: B-Runtime | Plane: Decision | Tier: 3
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { LLMService } from './services/llm.service.js';
import { AgentService } from './services/agent.service.js';
import { EmbeddingService } from './services/embedding.service.js';
import { RAGService } from './services/rag.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { LLMService } from './services/llm.service.js';
export { AgentService } from './services/agent.service.js';
export { EmbeddingService } from './services/embedding.service.js';
export { RAGService } from './services/rag.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap ai-engine
 */
export async function bootstrap(): Promise<void> {
  console.log('[ai-engine] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[ai-engine] Providers initialized:', Object.keys(providers).join(', '));

  const lLMService = new LLMService();
  const agentService = new AgentService();
  const embeddingService = new EmbeddingService();
  const rAGService = new RAGService();

  console.log('[ai-engine] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[ai-engine] Fatal error:', err);
    process.exit(1);
  });
}
