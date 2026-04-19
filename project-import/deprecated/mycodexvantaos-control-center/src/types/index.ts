/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface OrchestrationResult { success: boolean; reposProcessed: number; failures: string[]; duration: number; }

export interface OrchestrationStatus { phase: string; progress: number; currentTier: number; repoStatuses: Record<string, string>; }

export interface RepoEntry { name: string; layer: string; plane: string; tier: number; status: string; }

export interface SyncResult { synced: number; added: number; removed: number; errors: string[]; }

export interface RepoState { name: string; lastAction: string; status: string; updatedAt: Date; }

export interface GlobalState { mode: string; phase: string; repos: Record<string, RepoState>; startedAt: Date; }
