/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface Module { name: string; version: string; status: "loaded" | "unloaded" | "error"; exports: Record<string, unknown>; }

export interface Plugin { id: string; name: string; version: string; enabled: boolean; author: string; description: string; }
