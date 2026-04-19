/**
 * CodexvantaOS — automation-core / StepRunnerService
 * Individual step execution and retry logic
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface StepExecution { stepName: string; status: 'running' | 'completed' | 'failed' | 'retrying'; attempts: number; maxAttempts: number; output?: unknown; error?: string; startedAt: number; completedAt?: number; }

export class StepRunnerService {
  private get providers() { return getProviders(); }

  async run(stepName: string, handler: () => Promise<unknown>, options?: { maxAttempts?: number; retryDelay?: number }): Promise<StepExecution> {
    const maxAttempts = options?.maxAttempts ?? 3;
    const retryDelay = options?.retryDelay ?? 1000;
    const execution: StepExecution = { stepName, status: 'running', attempts: 0, maxAttempts, startedAt: Date.now() };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      execution.attempts = attempt;
      try {
        execution.output = await handler();
        execution.status = 'completed';
        execution.completedAt = Date.now();
        await this.providers.stateStore.set(`automation:step:${stepName}:${execution.startedAt}`, execution);
        this.providers.observability.info('Step completed', { step: stepName, attempt });
        return execution;
      } catch (err) {
        execution.error = String(err);
        if (attempt < maxAttempts) {
          execution.status = 'retrying';
          this.providers.observability.warn('Step retrying', { step: stepName, attempt, error: execution.error });
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
        }
      }
    }
    execution.status = 'failed';
    execution.completedAt = Date.now();
    await this.providers.stateStore.set(`automation:step:${stepName}:${execution.startedAt}`, execution);
    this.providers.observability.error('Step failed after all retries', { step: stepName, attempts: execution.attempts });
    return execution;
  }

  async getHistory(stepName: string, limit: number = 10): Promise<StepExecution[]> {
    const result = await this.providers.stateStore.scan<StepExecution>({ pattern: `automation:step:${stepName}:*`, count: limit });
    return result.entries.map(e => e.value).sort((a, b) => b.startedAt - a.startedAt);
  }
}
