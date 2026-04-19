/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface Policy { id: string; name: string; rules: PolicyRule[]; severity: "low" | "medium" | "high" | "critical"; enabled: boolean; }

export interface PolicyRule { condition: string; action: "allow" | "deny" | "warn"; message: string; }

export interface PolicyResult { policyId: string; passed: boolean; violations: Violation[]; evaluatedAt: Date; }

export interface Violation { ruleIndex: number; message: string; severity: string; context: Record<string, unknown>; }

export interface EnforcementResult { enforced: boolean; actions: string[]; blocked: boolean; }
