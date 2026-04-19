import { randomInt } from 'node:crypto';
/**
 * CodexvantaOS — network-mesh / LoadBalancerService
 * Load balancing strategies
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type LBStrategy = 'round-robin' | 'weighted' | 'least-connections' | 'random';
export interface LBConfig { name: string; strategy: LBStrategy; endpoints: Array<{ host: string; port: number; weight?: number }>; healthCheckInterval?: number; }

export class LoadBalancerService {
  private configs = new Map<string, LBConfig>();
  private rrCounters = new Map<string, number>();
  private connectionCounts = new Map<string, number>();
  private get providers() { return getProviders(); }

  async configure(config: LBConfig): Promise<void> {
    this.configs.set(config.name, config);
    this.rrCounters.set(config.name, 0);
    await this.providers.stateStore.set(`mesh:lb:${config.name}`, config);
    this.providers.observability.info('Load balancer configured', { name: config.name, strategy: config.strategy, endpoints: config.endpoints.length });
  }

  async resolve(name: string): Promise<{ host: string; port: number } | null> {
    const config = this.configs.get(name);
    if (!config || config.endpoints.length === 0) return null;
    switch (config.strategy) {
      case 'round-robin': {
        const idx = (this.rrCounters.get(name) ?? 0) % config.endpoints.length;
        this.rrCounters.set(name, idx + 1);
        return config.endpoints[idx];
      }
      case 'weighted': {
        const totalWeight = config.endpoints.reduce((sum, e) => sum + (e.weight ?? 1), 0);
        let r = (randomInt(0, 1_000_000) / 1_000_000) * totalWeight;
        for (const ep of config.endpoints) { r -= (ep.weight ?? 1); if (r <= 0) return ep; }
        return config.endpoints[0];
      }
      case 'random': return config.endpoints[randomInt(config.endpoints.length)];
      case 'least-connections': {
        let min = Infinity; let selected = config.endpoints[0];
        for (const ep of config.endpoints) { const key = `${ep.host}:${ep.port}`; const count = this.connectionCounts.get(key) ?? 0; if (count < min) { min = count; selected = ep; } }
        return selected;
      }
      default: return config.endpoints[0];
    }
  }

  async getConfig(name: string): Promise<LBConfig | null> { return this.configs.get(name) ?? null; }
}
