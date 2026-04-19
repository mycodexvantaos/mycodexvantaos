/**
 * CodexvantaOS — observability-stack / AlertingService
 * In-memory alert rule management
 */

import type { AlertRule } from "./types";

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertRule["severity"];
  message: string;
  firedAt: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

export class AlertingService {
  private rules = new Map<string, AlertRule>();
  private alerts: Alert[] = [];

  upsertRule(rule: AlertRule): AlertRule {
    this.rules.set(rule.id, rule);
    return rule;
  }

  getRule(ruleId: string): AlertRule | null {
    return this.rules.get(ruleId) ?? null;
  }

  deleteRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  listRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  fireAlert(ruleId: string, message: string): Alert {
    const rule = this.rules.get(ruleId);
    if (!rule) throw new Error(`Alert rule not found: ${ruleId}`);
    const alert: Alert = {
      id: `alert-${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message,
      firedAt: new Date(),
      acknowledged: false,
    };
    this.alerts.push(alert);
    return alert;
  }

  acknowledge(alertId: string, acknowledgedBy: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) throw new Error(`Alert not found: ${alertId}`);
    alert.acknowledged = true;
    alert.acknowledgedBy = acknowledgedBy;
  }

  listAlerts(options?: { severity?: AlertRule["severity"]; acknowledged?: boolean }): Alert[] {
    let result = [...this.alerts];
    if (options?.severity) result = result.filter((a) => a.severity === options.severity);
    if (options?.acknowledged !== undefined) result = result.filter((a) => a.acknowledged === options.acknowledged);
    return result;
  }

  evaluate(context: Record<string, unknown>): Alert[] {
    const fired: Alert[] = [];
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      // Simple keyword match evaluation
      const condKey = rule.condition;
      if (condKey in context) {
        const alert = this.fireAlert(rule.id, `Condition "${condKey}" triggered with value: ${context[condKey]}`);
        fired.push(alert);
      }
    }
    return fired;
  }
}