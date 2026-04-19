import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — decision-engine / RuleEngineService
 * Business rule evaluation engine
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface DecisionRule { id: string; name: string; priority: number; conditions: RuleCondition[]; actions: RuleAction[]; enabled: boolean; }
export interface RuleCondition { field: string; operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'contains' | 'regex'; value: unknown; }
export interface RuleAction { type: 'set' | 'notify' | 'route' | 'block' | 'log'; config: Record<string, unknown>; }
export interface DecisionResult { matched: string[]; actions: RuleAction[]; evaluatedCount: number; duration: number; }

export class RuleEngineService {
  private get providers() { return getProviders(); }

  async evaluate(facts: Record<string, unknown>): Promise<DecisionResult> {
    const start = Date.now();
    const rules = await this.loadRules();
    const matched: string[] = [];
    const actions: RuleAction[] = [];
    for (const rule of rules) {
      if (!rule.enabled) continue;
      if (this.evaluateConditions(rule.conditions, facts)) {
        matched.push(rule.id);
        actions.push(...rule.actions);
      }
    }
    const result: DecisionResult = { matched, actions, evaluatedCount: rules.length, duration: Date.now() - start };
    this.providers.observability.debug('Rules evaluated', { matched: matched.length, total: rules.length });
    return result;
  }

  async addRule(rule: Omit<DecisionRule, 'id'>): Promise<DecisionRule> {
    const id = `rule-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const entry: DecisionRule = { ...rule, id };
    await this.providers.stateStore.set(`decision:rule:${id}`, entry);
    return entry;
  }

  async getRule(id: string): Promise<DecisionRule | null> { return (await this.providers.stateStore.get<DecisionRule>(`decision:rule:${id}`))?.value ?? null; }
  async deleteRule(id: string): Promise<boolean> { return this.providers.stateStore.delete(`decision:rule:${id}`); }

  async listRules(): Promise<DecisionRule[]> { return this.loadRules(); }

  private async loadRules(): Promise<DecisionRule[]> {
    const result = await this.providers.stateStore.scan<DecisionRule>({ pattern: 'decision:rule:*', count: 200 });
    return result.entries.map(e => e.value).filter(r => r.conditions).sort((a, b) => b.priority - a.priority);
  }

  private evaluateConditions(conditions: RuleCondition[], facts: Record<string, unknown>): boolean {
    return conditions.every(c => {
      const value = facts[c.field];
      switch (c.operator) {
        case 'eq': return value === c.value;
        case 'neq': return value !== c.value;
        case 'gt': return Number(value) > Number(c.value);
        case 'lt': return Number(value) < Number(c.value);
        case 'gte': return Number(value) >= Number(c.value);
        case 'lte': return Number(value) <= Number(c.value);
        case 'in': return Array.isArray(c.value) && c.value.includes(value);
        case 'contains': return String(value).includes(String(c.value));
        case 'regex': return new RegExp(String(c.value)).test(String(value));
        default: return false;
      }
    });
  }
}
