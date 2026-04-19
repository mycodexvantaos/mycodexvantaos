/**
 * CodexvantaOS — data-pipeline / ExportService
 * In-memory data export target management
 */

import type { ExportTarget, ExportResult } from "./types";

export class ExportService {
  private targets = new Map<string, ExportTarget>();
  private exported = new Map<string, unknown[]>();

  async registerTarget(name: string, type: string, config: Record<string, unknown> = {}): Promise<ExportTarget> {
    const id = `target-${name}-${Date.now()}`;
    const target: ExportTarget = { id, name, type, config };
    this.targets.set(id, target);
    this.exported.set(id, []);
    return target;
  }

  async exportData(targetId: string, data: unknown[]): Promise<ExportResult> {
    const target = this.targets.get(targetId);
    if (!target) throw new Error(`Export target not found: ${targetId}`);
    const start = Date.now();
    const existing = this.exported.get(targetId) ?? [];
    existing.push(...data);
    this.exported.set(targetId, existing);
    return {
      targetId,
      recordsExported: data.length,
      duration: Date.now() - start,
    };
  }

  async getExported(targetId: string): Promise<unknown[]> {
    return this.exported.get(targetId) ?? [];
  }

  async listTargets(): Promise<ExportTarget[]> {
    return Array.from(this.targets.values());
  }

  async removeTarget(targetId: string): Promise<boolean> {
    this.exported.delete(targetId);
    return this.targets.delete(targetId);
  }
}