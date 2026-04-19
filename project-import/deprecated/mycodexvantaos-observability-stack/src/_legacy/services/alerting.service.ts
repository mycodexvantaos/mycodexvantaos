/**
 * CodexvantaOS — observability-stack / AlertingService
 * Alert management facade
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export interface AlertRule { id: string; name: string; condition: string; severity: AlertSeverity; enabled: boolean; cooldownSec?: number; }

export class AlertingService {
  private get providers() { return getProviders(); }

  async upsertRule(rule: AlertRule): Promise<AlertRule> {
    if (this.providers.observability.upsertAlertRule) return this.providers.observability.upsertAlertRule(rule);
    await this.providers.stateStore.set(`alert:rule:${rule.id}`, rule);
    return rule;
  }

  async listRules(): Promise<AlertRule[]> {
    if (this.providers.observability.listAlertRules) return this.providers.observability.listAlertRules();
    const result = await this.providers.stateStore.scan<AlertRule>({ pattern: 'alert:rule:*' });
    return result.entries.map(e => e.value);
  }

  async deleteRule(ruleId: string): Promise<void> {
    if (this.providers.observability.deleteAlertRule) return this.providers.observability.deleteAlertRule(ruleId);
    await this.providers.stateStore.delete(`alert:rule:${ruleId}`);
  }

  async listAlerts(options?: { severity?: AlertSeverity; since?: number; limit?: number }): Promise<any[]> {
    if (this.providers.observability.listAlerts) return this.providers.observability.listAlerts(options);
    return [];
  }

  async acknowledge(alertId: string, acknowledgedBy: string): Promise<void> {
    if (this.providers.observability.acknowledgeAlert) return this.providers.observability.acknowledgeAlert(alertId, acknowledgedBy);
    this.providers.observability.info('Alert acknowledged', { alertId, acknowledgedBy });
  }

  async fireAlert(opts: { ruleName: string; severity: AlertSeverity; message: string }): Promise<void> {
    const alert = { id: `alert-${Date.now()}`, ...opts, firedAt: Date.now() };
    await this.providers.stateStore.set(`alert:active:${alert.id}`, alert, { ttl: 86400 });
    await this.providers.notification.send({
      channels: ['stdout', 'webhook'], priority: opts.severity === 'critical' ? 'critical' : 'high',
      subject: `[${opts.severity.toUpperCase()}] ${opts.ruleName}`, body: opts.message, recipients: ['ops-team'],
    });
    this.providers.observability.warn('Alert fired', alert);
  }
}
