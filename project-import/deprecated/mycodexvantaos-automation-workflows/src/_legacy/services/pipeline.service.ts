import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — workflows / PipelineService
 * CI/CD pipeline integration
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type PipelineStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export interface Pipeline { id: string; repo: string; ref: string; trigger: string; status: PipelineStatus; stages: PipelineStage[]; startedAt: number; completedAt?: number; }
export interface PipelineStage { name: string; status: PipelineStatus; jobs: string[]; startedAt?: number; completedAt?: number; }

export class PipelineService {
  private get providers() { return getProviders(); }

  async trigger(repo: string, ref: string, trigger: string = 'manual'): Promise<Pipeline> {
    const id = `pipe-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const pipeline: Pipeline = {
      id, repo, ref, trigger, status: 'queued',
      stages: [
        { name: 'build', status: 'queued', jobs: ['compile', 'lint'] },
        { name: 'test', status: 'queued', jobs: ['unit-test', 'integration-test'] },
        { name: 'deploy', status: 'queued', jobs: ['deploy-staging'] },
      ],
      startedAt: Date.now(),
    };
    await this.providers.stateStore.set(`workflows:pipeline:${id}`, pipeline);
    await this.providers.queue.enqueue('workflows:pipeline:execute', { pipelineId: id });
    this.providers.observability.info('Pipeline triggered', { pipelineId: id, repo, ref, trigger });
    return pipeline;
  }

  async get(pipelineId: string): Promise<Pipeline | null> { return (await this.providers.stateStore.get<Pipeline>(`workflows:pipeline:${pipelineId}`))?.value ?? null; }

  async updateStage(pipelineId: string, stageName: string, status: PipelineStatus): Promise<Pipeline> {
    const pipeline = await this.get(pipelineId);
    if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);
    const stage = pipeline.stages.find(s => s.name === stageName);
    if (stage) {
      stage.status = status;
      if (status === 'running') stage.startedAt = Date.now();
      if (['succeeded', 'failed', 'cancelled'].includes(status)) stage.completedAt = Date.now();
    }
    // Update overall pipeline status
    if (pipeline.stages.every(s => s.status === 'succeeded')) { pipeline.status = 'succeeded'; pipeline.completedAt = Date.now(); }
    else if (pipeline.stages.some(s => s.status === 'failed')) { pipeline.status = 'failed'; pipeline.completedAt = Date.now(); }
    else if (pipeline.stages.some(s => s.status === 'running')) pipeline.status = 'running';
    await this.providers.stateStore.set(`workflows:pipeline:${pipelineId}`, pipeline);
    return pipeline;
  }

  async cancel(pipelineId: string): Promise<Pipeline> {
    const pipeline = await this.get(pipelineId);
    if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);
    pipeline.status = 'cancelled'; pipeline.completedAt = Date.now();
    await this.providers.stateStore.set(`workflows:pipeline:${pipelineId}`, pipeline);
    return pipeline;
  }

  async list(repo?: string, limit: number = 20): Promise<Pipeline[]> {
    const result = await this.providers.stateStore.scan<Pipeline>({ pattern: 'workflows:pipeline:*', count: limit });
    let pipelines = result.entries.map(e => e.value).filter(p => p.stages);
    if (repo) pipelines = pipelines.filter(p => p.repo === repo);
    return pipelines.sort((a, b) => b.startedAt - a.startedAt);
  }
}
