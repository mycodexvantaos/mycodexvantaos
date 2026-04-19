/**
 * CodexvantaOS — infra-base / ProvisioningService
 * Infrastructure provisioning and resource management
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type ResourceType = 'database' | 'storage' | 'queue' | 'cache' | 'compute' | 'network';
export type ResourceStatus = 'provisioning' | 'ready' | 'degraded' | 'destroying' | 'destroyed' | 'error';
export interface Resource { id: string; name: string; type: ResourceType; status: ResourceStatus; provider: string; config: Record<string, unknown>; endpoints?: Record<string, string>; createdAt: number; updatedAt: number; }

export class ProvisioningService {
  private get providers() { return getProviders(); }

  async provision(request: { name: string; type: ResourceType; config?: Record<string, unknown> }): Promise<Resource> {
    const id = `res-${request.type}-${Date.now()}`;
    const resource: Resource = { id, name: request.name, type: request.type, status: 'provisioning', provider: 'native', config: request.config ?? {}, createdAt: Date.now(), updatedAt: Date.now() };
    await this.providers.stateStore.set(`infra:resource:${id}`, resource);
    this.providers.observability.info('Resource provisioning', { id, type: request.type });
    resource.status = 'ready'; resource.updatedAt = Date.now();
    resource.endpoints = this.generateEndpoints(request.type);
    await this.providers.stateStore.set(`infra:resource:${id}`, resource);
    return resource;
  }

  async destroy(resourceId: string): Promise<void> {
    const entry = await this.providers.stateStore.get<Resource>(`infra:resource:${resourceId}`);
    if (!entry) throw new Error(`Resource not found: ${resourceId}`);
    const resource = entry.value;
    resource.status = 'destroyed'; resource.updatedAt = Date.now();
    await this.providers.stateStore.set(`infra:resource:${resourceId}`, resource);
    this.providers.observability.info('Resource destroyed', { id: resourceId });
  }

  async getResource(resourceId: string): Promise<Resource | null> {
    const entry = await this.providers.stateStore.get<Resource>(`infra:resource:${resourceId}`);
    return entry?.value ?? null;
  }

  async listResources(filter?: { type?: ResourceType; status?: ResourceStatus }): Promise<Resource[]> {
    const result = await this.providers.stateStore.scan<Resource>({ pattern: 'infra:resource:*', count: 200 });
    let resources = result.entries.map(e => e.value);
    if (filter?.type) resources = resources.filter(r => r.type === filter.type);
    if (filter?.status) resources = resources.filter(r => r.status === filter.status);
    return resources;
  }

  private generateEndpoints(type: ResourceType): Record<string, string> {
    switch (type) {
      case 'database': return { primary: 'sqlite:///data/platform.db' };
      case 'storage': return { local: 'file:///data/storage' };
      case 'queue': return { internal: 'memory://queue' };
      default: return {};
    }
  }
}
