/**
 * CodexvantaOS — data-pipeline / IngestionService
 * In-memory data source registration and ingestion
 */

import type { DataSource, IngestionResult } from "./types";

export class IngestionService {
  private sources = new Map<string, DataSource>();
  private records = new Map<string, unknown[]>();

  async registerSource(name: string, type: string, config: Record<string, unknown> = {}): Promise<DataSource> {
    const id = `src-${name}-${Date.now()}`;
    const source: DataSource = { id, name, type, config, status: "active" };
    this.sources.set(id, source);
    this.records.set(id, []);
    return source;
  }

  async ingest(sourceId: string, data: unknown[]): Promise<IngestionResult> {
    const source = this.sources.get(sourceId);
    if (!source) throw new Error(`Source not found: ${sourceId}`);
    const start = Date.now();
    const existing = this.records.get(sourceId) ?? [];
    existing.push(...data);
    this.records.set(sourceId, existing);
    return {
      sourceId,
      recordsIngested: data.length,
      duration: Date.now() - start,
      errors: [],
    };
  }

  async getRecords(sourceId: string): Promise<unknown[]> {
    return this.records.get(sourceId) ?? [];
  }

  async listSources(): Promise<DataSource[]> {
    return Array.from(this.sources.values());
  }

  async removeSource(sourceId: string): Promise<boolean> {
    this.records.delete(sourceId);
    return this.sources.delete(sourceId);
  }
}