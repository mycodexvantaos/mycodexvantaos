import { randomInt } from 'node:crypto';
/**
 * CodexvantaOS — network-mesh / ServiceDiscoveryService
 * Service discovery and registration
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface ServiceEndpoint { name: string; host: string; port: number; protocol: 'http' | 'https' | 'grpc'; weight: number; healthy: boolean; metadata?: Record<string, string>; registeredAt: number; lastHealthCheck?: number; }

export class ServiceDiscoveryService {
  private get providers() { return getProviders(); }

  async register(endpoint: Omit<ServiceEndpoint, 'registeredAt'>): Promise<ServiceEndpoint> {
    const entry: ServiceEndpoint = { ...endpoint, registeredAt: Date.now() };
    await this.providers.stateStore.set(`mesh:endpoint:${endpoint.name}:${endpoint.host}:${endpoint.port}`, entry, { ttl: 300 });
    this.providers.observability.info('Service endpoint registered', { name: endpoint.name, host: endpoint.host, port: endpoint.port });
    return entry;
  }

  async deregister(name: string, host: string, port: number): Promise<boolean> {
    return this.providers.stateStore.delete(`mesh:endpoint:${name}:${host}:${port}`);
  }

  async discover(name: string, onlyHealthy: boolean = true): Promise<ServiceEndpoint[]> {
    const result = await this.providers.stateStore.scan<ServiceEndpoint>({ pattern: `mesh:endpoint:${name}:*` });
    let endpoints = result.entries.map(e => e.value);
    if (onlyHealthy) endpoints = endpoints.filter(e => e.healthy);
    return endpoints.sort((a, b) => b.weight - a.weight);
  }

  async resolveOne(name: string): Promise<ServiceEndpoint | null> {
    const endpoints = await this.discover(name, true);
    if (endpoints.length === 0) return null;
    const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
    let random = (randomInt(0, 1_000_000) / 1_000_000) * totalWeight;
    for (const ep of endpoints) { random -= ep.weight; if (random <= 0) return ep; }
    return endpoints[0];
  }

  async heartbeat(name: string, host: string, port: number, healthy: boolean = true): Promise<void> {
    const key = `mesh:endpoint:${name}:${host}:${port}`;
    const entry = await this.providers.stateStore.get<ServiceEndpoint>(key);
    if (entry) {
      const updated = { ...entry.value, healthy, lastHealthCheck: Date.now() };
      await this.providers.stateStore.set(key, updated, { ttl: 300 });
    }
  }
}
