import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — data-pipeline / IngestionService
 * Data ingestion from various sources
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type SourceType = 'file' | 'api' | 'database' | 'stream' | 'webhook';
export interface IngestionJob { id: string; source: SourceType; config: Record<string, unknown>; status: 'pending' | 'running' | 'completed' | 'failed'; recordsProcessed: number; startedAt: number; completedAt?: number; error?: string; }

export class IngestionService {
  private get providers() { return getProviders(); }

  async ingest(source: SourceType, config: Record<string, unknown>): Promise<IngestionJob> {
    const job: IngestionJob = { id: `ingest-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`, source, config, status: 'running', recordsProcessed: 0, startedAt: Date.now() };
    await this.providers.stateStore.set(`pipeline:ingest:${job.id}`, job);
    this.providers.observability.info('Ingestion started', { jobId: job.id, source });
    try {
      switch (source) {
        case 'file': job.recordsProcessed = await this.ingestFromFile(config); break;
        case 'api': job.recordsProcessed = await this.ingestFromAPI(config); break;
        case 'database': job.recordsProcessed = await this.ingestFromDB(config); break;
        default: job.recordsProcessed = 0;
      }
      job.status = 'completed';
    } catch (err) { job.status = 'failed'; job.error = String(err); }
    job.completedAt = Date.now();
    await this.providers.stateStore.set(`pipeline:ingest:${job.id}`, job);
    return job;
  }

  async getJob(jobId: string): Promise<IngestionJob | null> {
    const entry = await this.providers.stateStore.get<IngestionJob>(`pipeline:ingest:${jobId}`);
    return entry?.value ?? null;
  }

  async listJobs(limit: number = 20): Promise<IngestionJob[]> {
    const result = await this.providers.stateStore.scan<IngestionJob>({ pattern: 'pipeline:ingest:*', count: limit });
    return result.entries.map(e => e.value);
  }

  private async ingestFromFile(config: Record<string, unknown>): Promise<number> {
    const key = config['path'] as string;
    if (!key) throw new Error('File path required');
    const file = await this.providers.storage.get(key);
    const content = new TextDecoder().decode(file.data);
    const lines = content.split('\n').filter(l => l.trim());
    for (const line of lines) {
      await this.providers.queue.enqueue('pipeline:raw-data', { source: 'file', data: line });
    }
    return lines.length;
  }

  private async ingestFromAPI(config: Record<string, unknown>): Promise<number> {
    const data = config['data'] as any[] ?? [];
    for (const record of data) { await this.providers.queue.enqueue('pipeline:raw-data', { source: 'api', data: record }); }
    return data.length;
  }

  private async ingestFromDB(config: Record<string, unknown>): Promise<number> {
    const query = config['query'] as string;
    if (!query) throw new Error('SQL query required');
    const result = await this.providers.database.query(query);
    for (const row of result.rows) { await this.providers.queue.enqueue('pipeline:raw-data', { source: 'database', data: row }); }
    return result.rowCount;
  }
}
