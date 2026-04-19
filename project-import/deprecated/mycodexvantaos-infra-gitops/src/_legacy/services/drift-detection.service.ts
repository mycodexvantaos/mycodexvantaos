/**
 * CodexvantaOS — infra-gitops / DriftDetectionService
 * Detect configuration drift between desired and actual state
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface DriftReport { repo: string; environment: string; hasDrift: boolean; drifts: DriftItem[]; checkedAt: number; }
export interface DriftItem { path: string; expected: unknown; actual: unknown; type: 'missing' | 'modified' | 'extra'; }

export class DriftDetectionService {
  private get providers() { return getProviders(); }

  async detect(repo: string, environment: string): Promise<DriftReport> {
    const report: DriftReport = { repo, environment, hasDrift: false, drifts: [], checkedAt: Date.now() };
    try {
      const desiredFile = await this.providers.repo.getFile(repo, `environments/${environment}/config.json`, 'main');
      if (!desiredFile) { report.drifts.push({ path: `environments/${environment}/config.json`, expected: 'exists', actual: 'missing', type: 'missing' }); report.hasDrift = true; }
      else {
        const desired = JSON.parse(desiredFile.content);
        const actualEntry = await this.providers.stateStore.get<Record<string, unknown>>(`gitops:actual:${repo}:${environment}`);
        const actual = actualEntry?.value ?? {};
        const drifts = this.compareObjects(desired, actual, '');
        report.drifts.push(...drifts);
        report.hasDrift = drifts.length > 0;
      }
    } catch (err) { report.drifts.push({ path: 'detection', expected: 'success', actual: String(err), type: 'missing' }); report.hasDrift = true; }
    await this.providers.stateStore.set(`gitops:drift:${repo}:${environment}`, report);
    if (report.hasDrift) this.providers.observability.warn('Configuration drift detected', { repo, environment, driftCount: report.drifts.length });
    return report;
  }

  async getLastReport(repo: string, environment: string): Promise<DriftReport | null> {
    const entry = await this.providers.stateStore.get<DriftReport>(`gitops:drift:${repo}:${environment}`);
    return entry?.value ?? null;
  }

  private compareObjects(expected: Record<string, unknown>, actual: Record<string, unknown>, prefix: string): DriftItem[] {
    const drifts: DriftItem[] = [];
    for (const [key, value] of Object.entries(expected)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in actual)) drifts.push({ path, expected: value, actual: undefined, type: 'missing' });
      else if (JSON.stringify(value) !== JSON.stringify(actual[key])) drifts.push({ path, expected: value, actual: actual[key], type: 'modified' });
    }
    for (const key of Object.keys(actual)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in expected)) drifts.push({ path, expected: undefined, actual: actual[key], type: 'extra' });
    }
    return drifts;
  }
}
