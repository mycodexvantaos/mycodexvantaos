import { randomBytes, randomInt } from 'node:crypto';
/**
 * CodexvantaOS — decision-engine / RoutingService
 * Dynamic request and workflow routing
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface RoutingRule { id: string; name: string; conditions: Record<string, unknown>; target: string; weight: number; enabled: boolean; }

export class RoutingService {
  private get providers() { return getProviders(); }

  async route(context: Record<string, unknown>): Promise<string> {
    const rules = await this.loadRules();
    const matching = rules.filter(r => r.enabled && this.matches(r.conditions, context));
    if (matching.length === 0) return 'default';
    // Weighted selection among matching rules
    const totalWeight = matching.reduce((sum, r) => sum + r.weight, 0);
    let random = (randomInt(0, 1_000_000) / 1_000_000) * totalWeight;
    for (const rule of matching) { random -= rule.weight; if (random <= 0) return rule.target; }
    return matching[0].target;
  }

  async addRule(rule: Omit<RoutingRule, 'id'>): Promise<RoutingRule> {
    const id = `route-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const entry: RoutingRule = { ...rule, id };
    await this.providers.stateStore.set(`decision:route:${id}`, entry);
    return entry;
  }

  async removeRule(id: string): Promise<boolean> { return this.providers.stateStore.delete(`decision:route:${id}`); }

  async listRules(): Promise<RoutingRule[]> { return this.loadRules(); }

  private async loadRules(): Promise<RoutingRule[]> {
    const result = await this.providers.stateStore.scan<RoutingRule>({ pattern: 'decision:route:*', count: 100 });
    return result.entries.map(e => e.value).filter(r => r.target).sort((a, b) => b.weight - a.weight);
  }

  private matches(conditions: Record<string, unknown>, context: Record<string, unknown>): boolean {
    for (const [key, expected] of Object.entries(conditions)) { if (context[key] !== expected) return false; }
    return true;
  }
}
