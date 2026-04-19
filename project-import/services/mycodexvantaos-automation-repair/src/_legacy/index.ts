/**
 * CodexvantaOS — automation-core
 * 自動化核心 — 工作流執行、Step Runner、狀態機
 * 
 * Layer: B-Runtime | Plane: Execution | Tier: 3
 * Philosophy: Native-first / Provider-agnostic
 * 「第三方服務是平台的擴充出口，不是平台成立的地基。」
 */

import 'dotenv/config';
import { initProviders, shutdownProviders } from './providers.js';
import { WorkflowEngineService } from './services/workflow-engine.service.js';
import { StepRunnerService } from './services/step-runner.service.js';
import { StateMachineService } from './services/state-machine.service.js';

// Re-export all types
export * from './types/index.js';

// Re-export services
export { WorkflowEngineService } from './services/workflow-engine.service.js';
export { StepRunnerService } from './services/step-runner.service.js';
export { StateMachineService } from './services/state-machine.service.js';
export { initProviders, getProviders, shutdownProviders } from './providers.js';

/**
 * Bootstrap automation-core
 */
export async function bootstrap(): Promise<void> {
  console.log('[automation-core] Starting in %s mode...', process.env.CODEXVANTA_MODE || 'auto-detect');

  // Initialize providers (auto-detects Native/Connected/Hybrid)
  const providers = await initProviders();
  console.log('[automation-core] Providers initialized:', Object.keys(providers).join(', '));

  const workflowEngineService = new WorkflowEngineService();
  const stepRunnerService = new StepRunnerService();
  const stateMachineService = new StateMachineService();

  console.log('[automation-core] Bootstrap complete. Services ready.');

  // Return services for external consumption
  return;
}

// Auto-bootstrap when run directly
if (process.argv[1] === import.meta.url.replace('file://', '')) {
  bootstrap().catch((err) => {
    console.error('[automation-core] Fatal error:', err);
    process.exit(1);
  });
}
