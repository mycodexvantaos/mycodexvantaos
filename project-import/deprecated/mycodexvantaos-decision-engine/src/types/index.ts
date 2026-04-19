/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface Rule { id: string; name: string; condition: string; action: string; priority: number; enabled: boolean; }

export interface RuleResult { ruleId: string; matched: boolean; action: string; context: Record<string, unknown>; }

export interface RouteDecision { target: string; matchedRule: string; confidence: number; }

export interface RouteRule { id: string; condition: string; target: string; priority: number; }
