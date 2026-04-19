import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — governance-autonomy / ComplianceService
 * Compliance monitoring and reporting
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'warning' | 'unknown';
export interface ComplianceCheck { id: string; framework: string; rule: string; description: string; status: ComplianceStatus; evidence?: string; checkedAt: number; }
export interface ComplianceReport { id: string; framework: string; checks: ComplianceCheck[]; overallStatus: ComplianceStatus; score: number; generatedAt: number; }

export class ComplianceService {
  private get providers() { return getProviders(); }

  async runCheck(framework: string, target: string): Promise<ComplianceReport> {
    const checks: ComplianceCheck[] = [];
    const rules = await this.getRules(framework);
    for (const rule of rules) {
      const status = await this.evaluateRule(rule, target);
      checks.push({ id: `check-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`, framework, rule: rule.name, description: rule.description, status, checkedAt: Date.now() });
    }
    const compliant = checks.filter(c => c.status === 'compliant').length;
    const score = checks.length > 0 ? Math.round((compliant / checks.length) * 100) : 0;
    const overallStatus: ComplianceStatus = score === 100 ? 'compliant' : score >= 80 ? 'warning' : 'non_compliant';
    const report: ComplianceReport = { id: `report-${Date.now()}`, framework, checks, overallStatus, score, generatedAt: Date.now() };
    await this.providers.stateStore.set(`governance:compliance:${report.id}`, report);
    this.providers.observability.info('Compliance check completed', { framework, score, status: overallStatus });
    return report;
  }

  async getReport(reportId: string): Promise<ComplianceReport | null> { return (await this.providers.stateStore.get<ComplianceReport>(`governance:compliance:${reportId}`))?.value ?? null; }

  async listReports(framework?: string): Promise<ComplianceReport[]> {
    const result = await this.providers.stateStore.scan<ComplianceReport>({ pattern: 'governance:compliance:*', count: 50 });
    let reports = result.entries.map(e => e.value).filter(r => r.checks);
    if (framework) reports = reports.filter(r => r.framework === framework);
    return reports.sort((a, b) => b.generatedAt - a.generatedAt);
  }

  private async getRules(framework: string): Promise<Array<{ name: string; description: string }>> {
    const defaults: Record<string, Array<{ name: string; description: string }>> = {
      'security': [
        { name: 'secret-rotation', description: 'Secrets must be rotated within 90 days' },
        { name: 'encryption-at-rest', description: 'All data at rest must be encrypted' },
        { name: 'auth-required', description: 'All endpoints must require authentication' },
      ],
      'operational': [
        { name: 'healthcheck-exists', description: 'All services must implement healthcheck' },
        { name: 'logging-enabled', description: 'Structured logging must be enabled' },
        { name: 'backup-configured', description: 'Automated backups must be configured' },
      ],
    };
    return defaults[framework] ?? [{ name: 'generic-check', description: 'Generic compliance check' }];
  }

  private async evaluateRule(rule: { name: string }, target: string): Promise<ComplianceStatus> {
    // In native mode: basic checks against state store
    try {
      const entry = await this.providers.stateStore.get(`compliance:evidence:${target}:${rule.name}`);
      return entry ? 'compliant' : 'warning';
    } catch { return 'unknown'; }
  }
}
