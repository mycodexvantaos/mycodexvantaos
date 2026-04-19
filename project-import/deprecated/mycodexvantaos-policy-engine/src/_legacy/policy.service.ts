import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — policy-engine / PolicyService
 * Policy definition and management
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface Policy { id: string; name: string; description?: string; rules: PolicyRule[]; enabled: boolean; priority: number; scope: 'global' | 'service' | 'repo'; createdAt: number; }
export interface PolicyRule { field: string; operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'matches'; value: unknown; action: 'allow' | 'deny' | 'warn'; }

export class PolicyService {
  private get providers() { return getProviders(); }

  async create(policy: Omit<Policy, 'id' | 'createdAt'>): Promise<Policy> {
    const id = `policy-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const entry: Policy = { ...policy, id, createdAt: Date.now() };
    await this.providers.stateStore.set(`policy:${id}`, entry);
    this.providers.observability.info('Policy created', { id, name: policy.name });
    return entry;
  }

  async get(id: string): Promise<Policy | null> { return (await this.providers.stateStore.get<Policy>(`policy:${id}`))?.value ?? null; }

  async update(id: string, updates: Partial<Omit<Policy, 'id' | 'createdAt'>>): Promise<Policy> {
    const policy = await this.get(id);
    if (!policy) throw new Error(`Policy not found: ${id}`);
    const updated: Policy = { ...policy, ...updates };
    await this.providers.stateStore.set(`policy:${id}`, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> { return this.providers.stateStore.delete(`policy:${id}`); }

  async list(scope?: 'global' | 'service' | 'repo'): Promise<Policy[]> {
    const result = await this.providers.stateStore.scan<Policy>({ pattern: 'policy:*', count: 200 });
    let policies = result.entries.map(e => e.value).filter(p => p.name !== undefined);
    if (scope) policies = policies.filter(p => p.scope === scope);
    return policies.sort((a, b) => b.priority - a.priority);
  }
}
