/**
 * CodexvantaOS — control-center / StateTrackingService
 * Platform-wide state tracking and synchronization
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface PlatformState {
  mode: 'native' | 'connected' | 'hybrid';
  status: 'starting' | 'running' | 'degraded' | 'shutting_down' | 'stopped';
  repositories: Record<string, RepoState>;
  lastUpdated: number;
  version: string;
}

export interface RepoState {
  name: string; lastSync: number; lastDeploy?: number;
  currentRef: string; status: 'synced' | 'pending' | 'deploying' | 'error';
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
}

export class StateTrackingService {
  private get providers() { return getProviders(); }

  async getState(): Promise<PlatformState> {
    const entry = await this.providers.stateStore.get<PlatformState>('platform:state');
    if (entry) return entry.value;
    return { mode: 'native', status: 'stopped', repositories: {}, lastUpdated: Date.now(), version: '2.1.0' };
  }

  async updateState(updates: Partial<PlatformState>): Promise<PlatformState> {
    const current = await this.getState();
    const updated: PlatformState = { ...current, ...updates, lastUpdated: Date.now() };
    await this.providers.stateStore.set('platform:state', updated);
    this.providers.observability.info('Platform state updated', { status: updated.status, mode: updated.mode });
    return updated;
  }

  async updateRepoState(name: string, updates: Partial<RepoState>): Promise<RepoState> {
    const state = await this.getState();
    const current = state.repositories[name] ?? { name, lastSync: 0, currentRef: 'main', status: 'pending' as const, health: 'unknown' as const };
    const updated: RepoState = { ...current, ...updates };
    state.repositories[name] = updated;
    state.lastUpdated = Date.now();
    await this.providers.stateStore.set('platform:state', state);
    return updated;
  }

  async getRepoState(name: string): Promise<RepoState | null> {
    const state = await this.getState();
    return state.repositories[name] ?? null;
  }

  async getHealthSummary(): Promise<{ total: number; healthy: number; degraded: number; unhealthy: number; unknown: number }> {
    const state = await this.getState();
    const repos = Object.values(state.repositories);
    return {
      total: repos.length, healthy: repos.filter(r => r.health === 'healthy').length,
      degraded: repos.filter(r => r.health === 'degraded').length,
      unhealthy: repos.filter(r => r.health === 'unhealthy').length,
      unknown: repos.filter(r => r.health === 'unknown').length,
    };
  }

  async checkpoint(label?: string): Promise<string> {
    const state = await this.getState();
    const checkpointId = `checkpoint-${Date.now()}`;
    await this.providers.stateStore.set(`platform:checkpoint:${checkpointId}`, { ...state, checkpointLabel: label ?? checkpointId }, { ttl: 86400 * 30 });
    this.providers.observability.info('State checkpoint created', { checkpointId });
    return checkpointId;
  }
}
