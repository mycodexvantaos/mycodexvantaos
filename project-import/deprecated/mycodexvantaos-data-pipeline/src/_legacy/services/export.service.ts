/**
 * CodexvantaOS — data-pipeline / ExportService
 * Data export to various targets
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type ExportFormat = 'json' | 'csv' | 'ndjson';
export interface ExportJob { id: string; format: ExportFormat; target: string; recordCount: number; status: 'pending' | 'completed' | 'failed'; outputPath?: string; startedAt: number; completedAt?: number; }

export class ExportService {
  private get providers() { return getProviders(); }

  async export(data: unknown[], format: ExportFormat, target: string): Promise<ExportJob> {
    const job: ExportJob = { id: `export-${Date.now()}`, format, target, recordCount: data.length, status: 'pending', startedAt: Date.now() };
    try {
      const content = this.serialize(data, format);
      const outputPath = `exports/${job.id}.${format}`;
      await this.providers.storage.put(outputPath, content, { contentType: this.getContentType(format) });
      job.outputPath = outputPath;
      job.status = 'completed';
    } catch (err) { job.status = 'failed'; }
    job.completedAt = Date.now();
    await this.providers.stateStore.set(`pipeline:export:${job.id}`, job);
    return job;
  }

  async getJob(jobId: string): Promise<ExportJob | null> {
    const entry = await this.providers.stateStore.get<ExportJob>(`pipeline:export:${jobId}`);
    return entry?.value ?? null;
  }

  private serialize(data: unknown[], format: ExportFormat): string {
    switch (format) {
      case 'json': return JSON.stringify(data, null, 2);
      case 'ndjson': return data.map(d => JSON.stringify(d)).join('\n');
      case 'csv': {
        if (data.length === 0) return '';
        const headers = Object.keys(data[0] as Record<string, unknown>);
        const rows = data.map(d => headers.map(h => String((d as any)[h] ?? '')).join(','));
        return [headers.join(','), ...rows].join('\n');
      }
      default: return JSON.stringify(data);
    }
  }

  private getContentType(format: ExportFormat): string {
    switch (format) { case 'json': return 'application/json'; case 'csv': return 'text/csv'; default: return 'application/octet-stream'; }
  }
}
