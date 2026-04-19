import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — control-center / OrchestrationService
 * Multi-repo orchestration and coordination
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type OrchAction = 'sync' | 'deploy' | 'validate' | 'rollback' | 'healthcheck';
export type OrchStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface OrchestrationRun {
  id: string;
  action: OrchAction;
  repositories: string[];
  status: OrchStatus;
  startedAt: number;
  completedAt?: number;
  results: Record<string, { status: OrchStatus; duration: number; error?: string }>;
  dryRun: boolean;
}

export class OrchestrationService {
  private get providers() { return getProviders(); }

  async execute(action: OrchAction, repositories: string[], options?: {
    dryRun?: boolean; force?: boolean; parallel?: boolean;
  }): Promise<OrchestrationRun> {
    const runId = `orch-${Date.now()}-${randomBytes(4).toString('hex').slice(0, 8)}`;
    const run: OrchestrationRun = {
      id: runId, action, repositories, status: 'running',
      startedAt: Date.now(), results: {}, dryRun: options?.dryRun ?? false,
    };
    await this.providers.stateStore.set(`orchestration:run:${runId}`, run);
    this.providers.observability.info('Orchestration started', { runId, action, repoCount: repositories.length });

    try {
      for (const repo of repositories) {
        const repoStart = Date.now();
        try {
          if (!options?.dryRun) {
            await this.executeForRepo(action, repo);
          }
          run.results[repo] = { status: 'completed', duration: Date.now() - repoStart };
        } catch (err) {
          run.results[repo] = { status: 'failed', duration: Date.now() - repoStart, error: String(err) };
          if (!options?.force) { run.status = 'failed'; break; }
        }
      }
      if (run.status === 'running') run.status = 'completed';
    } catch { run.status = 'failed'; }

    run.completedAt = Date.now();
    await this.providers.stateStore.set(`orchestration:run:${runId}`, run);
    this.providers.observability.info('Orchestration completed', { runId, status: run.status, duration: run.completedAt - run.startedAt });
    return run;
  }

  async getRunStatus(runId: string): Promise<OrchestrationRun | null> {
    const entry = await this.providers.stateStore.get<OrchestrationRun>(`orchestration:run:${runId}`);
    return entry?.value ?? null;
  }

  async listRuns(limit: number = 20): Promise<OrchestrationRun[]> {
    const result = await this.providers.stateStore.scan<OrchestrationRun>({ pattern: 'orchestration:run:*', count: limit });
    return result.entries.map(e => e.value);
  }

  async cancel(runId: string): Promise<OrchestrationRun> {
    const entry = await this.providers.stateStore.get<OrchestrationRun>(`orchestration:run:${runId}`);
    if (!entry) throw new Error(`Run not found: ${runId}`);
    const run = entry.value;
    if (run.status !== 'running') throw new Error(`Run is not running: ${run.status}`);
    run.status = 'cancelled';
    run.completedAt = Date.now();
    await this.providers.stateStore.set(`orchestration:run:${runId}`, run);
    return run;
  }

  private async executeForRepo(action: OrchAction, repo: string): Promise<void> {
    switch (action) {
      case 'sync': await this.providers.repo.listBranches(repo); break;
      case 'validate': await this.providers.validation.validate({ type: 'repository', path: repo }); break;
      case 'deploy': await this.providers.deploy.deploy({ repoName: repo, ref: 'main', environment: 'production' }); break;
      case 'healthcheck': await this.providers.repo.getRepo(repo); break;
      case 'rollback': await this.providers.deploy.rollback(repo, 'production'); break;
    }
  }
}
