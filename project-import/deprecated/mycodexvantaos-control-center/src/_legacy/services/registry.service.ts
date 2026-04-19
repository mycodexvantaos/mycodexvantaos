/**
 * CodexvantaOS — control-center / RegistryService
 * Service registry and discovery for the platform
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface RegisteredService {
  name: string;
  version: string;
  tier: number;
  layer: string;
  plane: string;
  endpoint?: string;
  capabilities: string[];
  registeredAt: number;
  lastHeartbeat: number;
  healthy: boolean;
  metadata?: Record<string, unknown>;
}

export class RegistryService {
  private get providers() { return getProviders(); }

  async register(service: Omit<RegisteredService, 'registeredAt' | 'lastHeartbeat' | 'healthy'>): Promise<RegisteredService> {
    const now = Date.now();
    const entry: RegisteredService = { ...service, registeredAt: now, lastHeartbeat: now, healthy: true };
    await this.providers.stateStore.set(`registry:service:${service.name}`, entry);
    this.providers.observability.info('Service registered', { service: service.name, tier: service.tier });
    return entry;
  }

  async deregister(name: string): Promise<boolean> {
    const deleted = await this.providers.stateStore.delete(`registry:service:${name}`);
    if (deleted) this.providers.observability.info('Service deregistered', { service: name });
    return deleted;
  }

  async lookup(name: string): Promise<RegisteredService | null> {
    const entry = await this.providers.stateStore.get<RegisteredService>(`registry:service:${name}`);
    return entry?.value ?? null;
  }

  async list(filter?: { tier?: number; layer?: string; plane?: string; healthy?: boolean }): Promise<RegisteredService[]> {
    const result = await this.providers.stateStore.scan<RegisteredService>({ pattern: 'registry:service:*', count: 100 });
    let services = result.entries.map(e => e.value);
    if (filter) {
      if (filter.tier !== undefined) services = services.filter(s => s.tier === filter.tier);
      if (filter.layer) services = services.filter(s => s.layer === filter.layer);
      if (filter.plane) services = services.filter(s => s.plane === filter.plane);
      if (filter.healthy !== undefined) services = services.filter(s => s.healthy === filter.healthy);
    }
    return services;
  }

  async heartbeat(name: string, healthy: boolean = true): Promise<void> {
    const entry = await this.providers.stateStore.get<RegisteredService>(`registry:service:${name}`);
    if (!entry) throw new Error(`Service not registered: ${name}`);
    const updated = { ...entry.value, lastHeartbeat: Date.now(), healthy };
    await this.providers.stateStore.set(`registry:service:${name}`, updated);
  }

  async findByCapability(capability: string): Promise<RegisteredService[]> {
    const all = await this.list();
    return all.filter(s => s.capabilities.includes(capability));
  }
}
