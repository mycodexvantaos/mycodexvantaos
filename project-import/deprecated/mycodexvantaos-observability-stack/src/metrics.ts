/**
 * CodexvantaOS — observability-stack / MetricsService
 * In-memory metrics collection
 */

import type { MetricResult } from "./types";

export type MetricType = "counter" | "gauge" | "histogram";

interface MetricDef {
  name: string;
  type: MetricType;
  description: string;
  value: number;
  labels: Record<string, string>;
  history: MetricResult[];
}

export class MetricsService {
  private metrics = new Map<string, MetricDef>();

  register(name: string, type: MetricType, description = ""): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, {
        name, type, description, value: 0, labels: {}, history: [],
      });
    }
  }

  increment(name: string, delta = 1, labels?: Record<string, string>): void {
    this.ensureMetric(name, "counter");
    const m = this.metrics.get(name)!;
    m.value += delta;
    m.labels = { ...m.labels, ...labels };
    this.recordHistory(m, labels);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.ensureMetric(name, "gauge");
    const m = this.metrics.get(name)!;
    m.value = value;
    m.labels = { ...m.labels, ...labels };
    this.recordHistory(m, labels);
  }

  observe(name: string, value: number, labels?: Record<string, string>): void {
    this.ensureMetric(name, "histogram");
    const m = this.metrics.get(name)!;
    m.value = value;
    this.recordHistory(m, labels);
  }

  record(name: string, value: number, labels?: Record<string, string>): void {
    const m = this.metrics.get(name);
    if (!m) {
      this.register(name, "gauge");
    }
    const metric = this.metrics.get(name)!;
    metric.value = value;
    this.recordHistory(metric, labels);
  }

  get(name: string): MetricDef | null {
    return this.metrics.get(name) ?? null;
  }

  query(name: string, options?: { since?: Date; limit?: number }): MetricResult[] {
    const m = this.metrics.get(name);
    if (!m) return [];
    let results = [...m.history];
    if (options?.since) results = results.filter((r) => r.timestamp >= options.since!);
    if (options?.limit) results = results.slice(-options.limit);
    return results;
  }

  list(): string[] {
    return Array.from(this.metrics.keys());
  }

  private ensureMetric(name: string, type: MetricType): void {
    if (!this.metrics.has(name)) this.register(name, type);
  }

  private recordHistory(m: MetricDef, labels?: Record<string, string>): void {
    m.history.push({
      name: m.name,
      value: m.value,
      timestamp: new Date(),
      tags: labels ?? {},
    });
  }
}