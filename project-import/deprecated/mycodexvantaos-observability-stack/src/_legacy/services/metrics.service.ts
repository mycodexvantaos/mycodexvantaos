/**
 * CodexvantaOS — observability-stack / MetricsService
 * Metrics collection and querying facade
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export class MetricsService {
  private get providers() { return getProviders(); }

  registerCounter(name: string, description: string, labels?: string[]): void { this.providers.observability.registerMetric({ name, type: 'counter', description, labels }); }
  registerGauge(name: string, description: string, labels?: string[]): void { this.providers.observability.registerMetric({ name, type: 'gauge', description, labels }); }
  registerHistogram(name: string, description: string, unit?: string, labels?: string[]): void { this.providers.observability.registerMetric({ name, type: 'histogram', description, unit, labels }); }
  increment(name: string, delta: number = 1, labels?: Record<string, string>): void { this.providers.observability.incrementCounter(name, delta, labels); }
  setGauge(name: string, value: number, labels?: Record<string, string>): void { this.providers.observability.setGauge(name, value, labels); }
  observe(name: string, value: number, labels?: Record<string, string>): void { this.providers.observability.observeHistogram(name, value, labels); }
  record(name: string, value: number, labels?: Record<string, string>): void { this.providers.observability.recordMetric(name, value, labels); }

  async query(options: { name: string; since?: number; aggregation?: string }): Promise<Array<{ timestamp: number; value: number }>> {
    const result = await this.providers.observability.queryMetrics(options as any);
    return result.dataPoints;
  }

  async timed<T>(metricName: string, fn: () => Promise<T>, labels?: Record<string, string>): Promise<T> {
    const start = Date.now();
    try { return await fn(); } finally { this.observe(metricName, Date.now() - start, labels); }
  }
}
