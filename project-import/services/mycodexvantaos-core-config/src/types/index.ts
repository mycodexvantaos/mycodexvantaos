/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export type ConfigValue = string | number | boolean | Record<string, unknown>;

export interface ConfigEntry { key: string; value: ConfigValue; namespace: string; updatedAt: Date; version: number; }

export interface FeatureFlag { key: string; enabled: boolean; description: string; rules: FlagRule[]; }

export interface FlagRule { condition: string; value: boolean; priority: number; }

export interface FlagEvaluation { key: string; enabled: boolean; matchedRule?: string; reason: string; }
