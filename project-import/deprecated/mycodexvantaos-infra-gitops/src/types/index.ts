/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface SyncResult { synced: boolean; changes: number; errors: string[]; }

export interface ApplyResult { applied: number; skipped: number; errors: string[]; }

export interface DesiredState { manifests: Record<string, unknown>[]; commitHash: string; branch: string; }

export interface ActualState { resources: Record<string, unknown>[]; lastSyncedAt: Date; }

export interface DriftReport { hasDrift: boolean; drifts: DriftItem[]; checkedAt: Date; }

export interface DriftItem { resource: string; field: string; expected: unknown; actual: unknown; }

export interface ReconcileResult { reconciled: number; failed: number; errors: string[]; }

export interface DriftEvent { id: string; detectedAt: Date; resolved: boolean; driftCount: number; }
