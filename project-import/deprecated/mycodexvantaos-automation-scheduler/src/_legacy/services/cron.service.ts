/**
 * CodexvantaOS — scheduler / CronService
 * Cron-style recurring task management
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface CronJob { id: string; name: string; expression: string; handler: string; enabled: boolean; lastRun?: number; nextRun: number; runCount: number; createdAt: number; }

export class CronService {
  private jobs = new Map<string, CronJob>();
  private get providers() { return getProviders(); }

  async register(name: string, expression: string, handler: string): Promise<CronJob> {
    const id = `cron-${name}-${Date.now()}`;
    const job: CronJob = { id, name, expression, handler, enabled: true, nextRun: this.calculateNextRun(expression), runCount: 0, createdAt: Date.now() };
    this.jobs.set(id, job);
    await this.providers.stateStore.set(`scheduler:cron:${id}`, job);
    this.providers.observability.info('Cron job registered', { id, name, expression });
    return job;
  }

  async unregister(jobId: string): Promise<boolean> {
    this.jobs.delete(jobId);
    return this.providers.stateStore.delete(`scheduler:cron:${jobId}`);
  }

  async enable(jobId: string): Promise<CronJob> { return this.toggle(jobId, true); }
  async disable(jobId: string): Promise<CronJob> { return this.toggle(jobId, false); }

  async listJobs(): Promise<CronJob[]> {
    if (this.jobs.size === 0) {
      const result = await this.providers.stateStore.scan<CronJob>({ pattern: 'scheduler:cron:*' });
      for (const e of result.entries) this.jobs.set(e.value.id, e.value);
    }
    return Array.from(this.jobs.values());
  }

  async processDueJobs(): Promise<number> {
    const now = Date.now(); let processed = 0;
    for (const [id, job] of this.jobs) {
      if (job.enabled && job.nextRun <= now) {
        await this.providers.queue.enqueue('scheduler:cron:execute', { jobId: id, handler: job.handler, timestamp: now });
        job.lastRun = now; job.nextRun = this.calculateNextRun(job.expression); job.runCount++;
        await this.providers.stateStore.set(`scheduler:cron:${id}`, job);
        processed++;
      }
    }
    return processed;
  }

  private async toggle(jobId: string, enabled: boolean): Promise<CronJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Cron job not found: ${jobId}`);
    job.enabled = enabled;
    await this.providers.stateStore.set(`scheduler:cron:${jobId}`, job);
    return job;
  }

  private calculateNextRun(expression: string): number {
    // Simplified: parse interval-based expressions like "every 5m", "every 1h"
    const match = expression.match(/every\s+(\d+)([smhd])/);
    if (match) {
      const value = parseInt(match[1]); const unit = match[2];
      const ms = value * ({ s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit] ?? 60000);
      return Date.now() + ms;
    }
    return Date.now() + 3600000; // default: 1 hour
  }
}
