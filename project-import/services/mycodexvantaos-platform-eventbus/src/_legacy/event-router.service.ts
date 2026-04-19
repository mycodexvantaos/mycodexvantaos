import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — event-bus / EventRouterService
 * Event routing and filtering
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface RoutingRule { id: string; sourceTopic: string; targetTopic: string; filter?: Record<string, unknown>; enabled: boolean; createdAt: number; }

export class EventRouterService {
  private rules = new Map<string, RoutingRule>();
  private get providers() { return getProviders(); }

  async addRule(rule: Omit<RoutingRule, 'id' | 'createdAt'>): Promise<RoutingRule> {
    const id = `rule-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const entry: RoutingRule = { ...rule, id, createdAt: Date.now() };
    this.rules.set(id, entry);
    await this.providers.stateStore.set(`eventrouter:rule:${id}`, entry);
    this.providers.observability.info('Routing rule added', { id, source: rule.sourceTopic, target: rule.targetTopic });
    return entry;
  }

  async removeRule(ruleId: string): Promise<boolean> {
    this.rules.delete(ruleId);
    return this.providers.stateStore.delete(`eventrouter:rule:${ruleId}`);
  }

  async listRules(): Promise<RoutingRule[]> {
    if (this.rules.size === 0) {
      const result = await this.providers.stateStore.scan<RoutingRule>({ pattern: 'eventrouter:rule:*' });
      for (const entry of result.entries) this.rules.set(entry.value.id, entry.value);
    }
    return Array.from(this.rules.values());
  }

  async route(sourceTopic: string, event: unknown): Promise<string[]> {
    const matching = Array.from(this.rules.values()).filter(r => r.enabled &amp;&amp; r.sourceTopic === sourceTopic);
    const routed: string[] = [];
    for (const rule of matching) {
      if (this.matchesFilter(event, rule.filter)) {
        await this.providers.queue.enqueue(rule.targetTopic, event);
        routed.push(rule.targetTopic);
      }
    }
    if (routed.length > 0) this.providers.observability.debug('Event routed', { source: sourceTopic, targets: routed });
    return routed;
  }

  async toggleRule(ruleId: string, enabled: boolean): Promise<RoutingRule> {
    const rule = this.rules.get(ruleId);
    if (!rule) throw new Error(`Rule not found: ${ruleId}`);
    rule.enabled = enabled;
    await this.providers.stateStore.set(`eventrouter:rule:${ruleId}`, rule);
    return rule;
  }

  private matchesFilter(event: unknown, filter?: Record<string, unknown>): boolean {
    if (!filter) return true;
    if (typeof event !== 'object' || event === null) return false;
    for (const [key, value] of Object.entries(filter)) { if ((event as any)[key] !== value) return false; }
    return true;
  }
}
