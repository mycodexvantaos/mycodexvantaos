/**
 * CodexvantaOS — policy-engine / PolicyEnforcerService
 * Policy evaluation and enforcement
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface EnforcementResult { allowed: boolean; violations: Array<{ policyId: string; policyName: string; rule: string; action: 'deny' | 'warn' }>; evaluatedPolicies: number; duration: number; }

export class PolicyEnforcerService {
  private get providers() { return getProviders(); }

  async enforce(context: Record<string, unknown>, scope?: 'global' | 'service' | 'repo'): Promise<EnforcementResult> {
    const start = Date.now();
    const policies = await this.loadPolicies(scope);
    const result: EnforcementResult = { allowed: true, violations: [], evaluatedPolicies: policies.length, duration: 0 };
    for (const policy of policies) {
      if (!policy.enabled) continue;
      for (const rule of policy.rules) {
        const matched = this.evaluateRule(rule, context);
        if (matched && rule.action !== 'allow') {
          result.violations.push({ policyId: policy.id, policyName: policy.name, rule: `${rule.field} ${rule.operator} ${rule.value}`, action: rule.action });
          if (rule.action === 'deny') result.allowed = false;
        }
      }
    }
    result.duration = Date.now() - start;
    if (!result.allowed) this.providers.observability.warn('Policy enforcement: denied', { violations: result.violations.length });
    return result;
  }

  private async loadPolicies(scope?: string): Promise<any[]> {
    const result = await this.providers.stateStore.scan<any>({ pattern: 'policy:*', count: 200 });
    let policies = result.entries.map(e => e.value).filter((p: any) => p.rules);
    if (scope) policies = policies.filter((p: any) => p.scope === scope);
    return policies.sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0));
  }

  private evaluateRule(rule: any, context: Record<string, unknown>): boolean {
    const fieldValue = context[rule.field];
    switch (rule.operator) {
      case 'eq': return fieldValue === rule.value;
      case 'neq': return fieldValue !== rule.value;
      case 'gt': return Number(fieldValue) > Number(rule.value);
      case 'lt': return Number(fieldValue) < Number(rule.value);
      case 'contains': return String(fieldValue).includes(String(rule.value));
      case 'matches': return new RegExp(String(rule.value)).test(String(fieldValue));
      default: return false;
    }
  }
}
