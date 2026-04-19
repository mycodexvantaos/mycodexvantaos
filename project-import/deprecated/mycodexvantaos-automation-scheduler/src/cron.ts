/**
 * CodexvantaOS — scheduler / CronService
 * In-memory cron job management
 */

import type { CronJob } from "./types";

export class CronService {
  private jobs = new Map<string, CronJob>();

  async register(name: string, expression: string, handler: string): Promise<CronJob> {
    const id = `cron-${name}-${Date.now()}`;
    const job: CronJob = {
      id,
      name,
      expression,
      handler,
      enabled: true,
      nextRun: new Date(Date.now() + this.parseInterval(expression)),
    };
    this.jobs.set(id, job);
    return job;
  }

  async unregister(jobId: string): Promise<boolean> {
    return this.jobs.delete(jobId);
  }

  async enable(jobId: string): Promise<CronJob> {
    return this.toggle(jobId, true);
  }

  async disable(jobId: string): Promise<CronJob> {
    return this.toggle(jobId, false);
  }

  async getJob(jobId: string): Promise<CronJob | null> {
    return this.jobs.get(jobId) ?? null;
  }

  async listJobs(): Promise<CronJob[]> {
    return Array.from(this.jobs.values());
  }

  async processDueJobs(): Promise<number> {
    const now = Date.now();
    let processed = 0;
    for (const job of this.jobs.values()) {
      if (job.enabled && job.nextRun && job.nextRun.getTime() <= now) {
        job.lastRun = new Date();
        job.nextRun = new Date(now + this.parseInterval(job.expression));
        processed++;
      }
    }
    return processed;
  }

  private toggle(jobId: string, enabled: boolean): CronJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Cron job not found: ${jobId}`);
    job.enabled = enabled;
    return job;
  }

  /**
   * Parse simplified interval expressions like "every 5m", "every 1h"
   * Returns milliseconds. Default: 1 hour.
   */
  private parseInterval(expression: string): number {
    const match = expression.match(/every\s+(\d+)([smhd])/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
      return value * (multipliers[unit] ?? 60000);
    }
    return 3600000; // default 1 hour
  }
}