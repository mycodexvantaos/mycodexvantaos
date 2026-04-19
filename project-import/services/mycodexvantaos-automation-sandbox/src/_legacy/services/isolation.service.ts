/**
 * CodexvantaOS — fleet-sandbox / IsolationService
 * Sandbox isolation and security boundaries
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface IsolationPolicy { sandboxId: string; networkIsolated: boolean; allowedPorts: number[]; resourceLimits: { cpuPercent: number; memoryMB: number; diskMB: number }; allowedDomains: string[]; readOnlyFS: boolean; }

export class IsolationService {
  private get providers() { return getProviders(); }

  async applyPolicy(policy: IsolationPolicy): Promise<void> {
    await this.providers.stateStore.set(`sandbox:isolation:${policy.sandboxId}`, policy);
    this.providers.observability.info('Isolation policy applied', { sandboxId: policy.sandboxId, networkIsolated: policy.networkIsolated });
  }

  async getPolicy(sandboxId: string): Promise<IsolationPolicy | null> {
    return (await this.providers.stateStore.get<IsolationPolicy>(`sandbox:isolation:${sandboxId}`))?.value ?? null;
  }

  async validateAccess(sandboxId: string, resource: { type: 'network' | 'filesystem' | 'port'; target: string }): Promise<{ allowed: boolean; reason?: string }> {
    const policy = await this.getPolicy(sandboxId);
    if (!policy) return { allowed: true };
    switch (resource.type) {
      case 'network':
        if (policy.networkIsolated && !policy.allowedDomains.some(d => resource.target.includes(d))) return { allowed: false, reason: 'Network access denied by isolation policy' };
        break;
      case 'port':
        if (!policy.allowedPorts.includes(parseInt(resource.target))) return { allowed: false, reason: `Port ${resource.target} not in allowed list` };
        break;
      case 'filesystem':
        if (policy.readOnlyFS && !resource.target.startsWith('/tmp')) return { allowed: false, reason: 'Read-only filesystem policy' };
        break;
    }
    return { allowed: true };
  }

  getDefaultPolicy(sandboxId: string): IsolationPolicy {
    return { sandboxId, networkIsolated: true, allowedPorts: [80, 443, 8080], resourceLimits: { cpuPercent: 50, memoryMB: 512, diskMB: 1024 }, allowedDomains: ['*.codexvanta.internal'], readOnlyFS: false };
  }
}
