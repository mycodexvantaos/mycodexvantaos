/**
 * CodexvantaOS — policy-engine
 * 策略引擎 — Policy definition, evaluation, enforcement
 *
 * Layer: B-Runtime | Tier: 1
 */
import pino from "pino";

const logger = pino({ name: "policy-engine" });

// Re-export types
export * from "./types";

export interface PolicyRule {
  field: string;
  operator: "eq" | "neq" | "gt" | "lt" | "contains" | "matches";
  value: unknown;
  action: "allow" | "deny" | "warn";
}

export interface Policy {
  id: string;
  name: string;
  description?: string;
  rules: PolicyRule[];
  enabled: boolean;
  priority: number;
  scope: "global" | "service" | "repo";
  createdAt: number;
}

export type EvaluationResult = {
  policyId: string;
  policyName: string;
  action: "allow" | "deny" | "warn";
  matched: boolean;
  details?: string;
};

/**
 * PolicyService — in-memory policy store and evaluator
 */
export class PolicyService {
  private policies = new Map<string, Policy>();
  private counter = 0;

  create(input: Omit<Policy, "id" | "createdAt">): Policy {
    const id = `policy-${++this.counter}`;
    const policy: Policy = { ...input, id, createdAt: Date.now() };
    this.policies.set(id, policy);
    logger.debug({ id, name: input.name }, "Policy created");
    return policy;
  }

  get(id: string): Policy | undefined {
    return this.policies.get(id);
  }

  delete(id: string): boolean {
    return this.policies.delete(id);
  }

  list(scope?: "global" | "service" | "repo"): Policy[] {
    const all = Array.from(this.policies.values());
    const filtered = scope ? all.filter((p) => p.scope === scope) : all;
    return filtered.sort((a, b) => b.priority - a.priority);
  }

  evaluate(context: Record<string, unknown>): EvaluationResult[] {
    const results: EvaluationResult[] = [];
    const sorted = this.list().filter((p) => p.enabled);

    for (const policy of sorted) {
      for (const rule of policy.rules) {
        const fieldValue = context[rule.field];
        const matched = this.matchRule(fieldValue, rule);
        results.push({
          policyId: policy.id,
          policyName: policy.name,
          action: rule.action,
          matched,
          details: matched ? `${rule.field} ${rule.operator} ${rule.value}` : undefined,
        });
      }
    }
    return results;
  }

  private matchRule(fieldValue: unknown, rule: PolicyRule): boolean {
    switch (rule.operator) {
      case "eq":
        return fieldValue === rule.value;
      case "neq":
        return fieldValue !== rule.value;
      case "gt":
        return typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue > rule.value;
      case "lt":
        return typeof fieldValue === "number" && typeof rule.value === "number" && fieldValue < rule.value;
      case "contains":
        return typeof fieldValue === "string" && typeof rule.value === "string" && fieldValue.includes(rule.value);
      case "matches":
        if (typeof fieldValue !== "string" || typeof rule.value !== "string") return false;
        try {
          return new RegExp(rule.value).test(fieldValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
}
