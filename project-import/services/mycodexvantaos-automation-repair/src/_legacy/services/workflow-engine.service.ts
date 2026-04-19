import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — automation-core / WorkflowEngineService
 * Workflow definition and execution engine
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type WFStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export interface WorkflowDef { id: string; name: string; steps: WFStep[]; triggers?: string[]; createdAt: number; }
export interface WFStep { name: string; type: 'action' | 'condition' | 'parallel' | 'wait'; config: Record<string, unknown>; onFailure?: 'stop' | 'continue' | 'retry'; maxRetries?: number; }
export interface WorkflowRun { id: string; workflowId: string; status: WFStatus; currentStep: number; stepResults: Record<string, { status: string; output?: unknown; error?: string }>; startedAt: number; completedAt?: number; }

export class WorkflowEngineService {
  private get providers() { return getProviders(); }

  async defineWorkflow(name: string, steps: WFStep[], triggers?: string[]): Promise<WorkflowDef> {
    const id = `wf-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const def: WorkflowDef = { id, name, steps, triggers, createdAt: Date.now() };
    await this.providers.stateStore.set(`automation:workflow:${id}`, def);
    this.providers.observability.info('Workflow defined', { id, name, steps: steps.length });
    return def;
  }

  async execute(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowRun> {
    const def = (await this.providers.stateStore.get<WorkflowDef>(`automation:workflow:${workflowId}`))?.value;
    if (!def) throw new Error(`Workflow not found: ${workflowId}`);
    const runId = `run-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const run: WorkflowRun = { id: runId, workflowId, status: 'running', currentStep: 0, stepResults: {}, startedAt: Date.now() };
    await this.providers.stateStore.set(`automation:run:${runId}`, run);

    for (let i = 0; i < def.steps.length; i++) {
      const step = def.steps[i];
      run.currentStep = i;
      try {
        const output = await this.executeStep(step, input);
        run.stepResults[step.name] = { status: 'completed', output };
      } catch (err) {
        run.stepResults[step.name] = { status: 'failed', error: String(err) };
        if (step.onFailure !== 'continue') { run.status = 'failed'; break; }
      }
      await this.providers.stateStore.set(`automation:run:${runId}`, run);
    }
    if (run.status === 'running') run.status = 'completed';
    run.completedAt = Date.now();
    await this.providers.stateStore.set(`automation:run:${runId}`, run);
    this.providers.observability.info('Workflow completed', { runId, status: run.status });
    return run;
  }

  async getRun(runId: string): Promise<WorkflowRun | null> { return (await this.providers.stateStore.get<WorkflowRun>(`automation:run:${runId}`))?.value ?? null; }
  async getWorkflow(workflowId: string): Promise<WorkflowDef | null> { return (await this.providers.stateStore.get<WorkflowDef>(`automation:workflow:${workflowId}`))?.value ?? null; }

  async listWorkflows(): Promise<WorkflowDef[]> {
    const result = await this.providers.stateStore.scan<WorkflowDef>({ pattern: 'automation:workflow:*', count: 100 });
    return result.entries.map(e => e.value);
  }

  private async executeStep(step: WFStep, input?: Record<string, unknown>): Promise<unknown> {
    switch (step.type) {
      case 'action': await this.providers.queue.enqueue('automation:actions', { step: step.name, config: step.config, input }); return { executed: true };
      case 'wait': {
          // Defensive: clamp duration to safe range to avoid eval-like attack vectors
          const rawMs = step.config['durationMs'];
          const ms = typeof rawMs === 'number' && Number.isFinite(rawMs) ? Math.max(0, Math.min(rawMs, 3_600_000)) : 1000;
          await new Promise(r => setTimeout(r, ms));
          return { waited: true };
        }
      case 'condition': return { evaluated: true, result: step.config['default'] ?? true };
      default: return { type: step.type };
    }
  }
}
