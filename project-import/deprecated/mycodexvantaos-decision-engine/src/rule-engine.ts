import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — decision-engine / RuleEngineService
 * In-memory rule evaluation engine
 */

import type { Rule, RuleResult } from "./types";
import { matchCondition } from "./utils/match";

export class RuleEngineService {
  private rules = new Map<string, Rule>();

  addRule(rule: Omit<Rule, "id">): Rule {
    const id = `rule-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const entry: Rule = { id, ...rule };
    this.rules.set(id, entry);
    return entry;
  }

  removeRule(ruleId: string): boolean {
    return this.rules.delete(ruleId);
  }

  getRule(ruleId: string): Rule | null {
    return this.rules.get(ruleId) ?? null;
  }

  listRules(): Rule[] {
    return Array.from(this.rules.values()).sort((a, b) => b.priority - a.priority);
  }

  evaluate(context: Record<string, unknown>): RuleResult[] {
    const results: RuleResult[] = [];
    const sorted = this.listRules();
    for (const rule of sorted) {
      if (!rule.enabled) continue;
      const matched = matchCondition(rule.condition, context);
      results.push({
        ruleId: rule.id,
        matched,
        action: matched ? rule.action : "",
        context,
      });
    }
    return results;
  }

  evaluateFirst(context: Record<string, unknown>): RuleResult | null {
    const sorted = this.listRules();
    for (const rule of sorted) {
      if (!rule.enabled) continue;
      if (matchCondition(rule.condition, context)) {
        return { ruleId: rule.id, matched: true, action: rule.action, context };
      }
    }
    return null;
  }
}