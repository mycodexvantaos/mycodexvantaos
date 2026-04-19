/**
 * CodexvantaOS — config-manager / ConfigService
 * Configuration management with layered resolution
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface ConfigEntry {
  key: string; value: unknown; scope: 'global' | 'service' | 'environment';
  namespace?: string; version: number; updatedAt: number; updatedBy?: string;
}

export class ConfigService {
  private cache = new Map<string, ConfigEntry>();
  private get providers() { return getProviders(); }

  async get<T = unknown>(key: string, options?: {
    scope?: 'global' | 'service' | 'environment'; namespace?: string; defaultValue?: T;
  }): Promise<T | undefined> {
    const cacheKey = this.buildKey(key, options?.scope, options?.namespace);
    const cached = this.cache.get(cacheKey);
    if (cached) return cached.value as T;

    const scopes: Array<'environment' | 'service' | 'global'> = options?.scope ? [options.scope] : ['environment', 'service', 'global'];
    for (const scope of scopes) {
      const storeKey = `config:${scope}:${options?.namespace ?? 'default'}:${key}`;
      const entry = await this.providers.stateStore.get<ConfigEntry>(storeKey);
      if (entry) { this.cache.set(cacheKey, entry.value); return entry.value.value as T; }
    }
    return options?.defaultValue;
  }

  async set(key: string, value: unknown, options?: {
    scope?: 'global' | 'service' | 'environment'; namespace?: string; updatedBy?: string;
  }): Promise<ConfigEntry> {
    const scope = options?.scope ?? 'global';
    const namespace = options?.namespace ?? 'default';
    const storeKey = `config:${scope}:${namespace}:${key}`;
    const existing = await this.providers.stateStore.get<ConfigEntry>(storeKey);
    const version = existing ? existing.value.version + 1 : 1;
    const entry: ConfigEntry = { key, value, scope, namespace, version, updatedAt: Date.now(), updatedBy: options?.updatedBy };
    await this.providers.stateStore.set(storeKey, entry);
    this.cache.set(this.buildKey(key, scope, namespace), entry);
    this.providers.observability.info('Config updated', { key, scope, version });
    return entry;
  }

  async delete(key: string, scope: string = 'global', namespace: string = 'default'): Promise<boolean> {
    const storeKey = `config:${scope}:${namespace}:${key}`;
    const deleted = await this.providers.stateStore.delete(storeKey);
    this.cache.delete(this.buildKey(key, scope, namespace));
    return deleted;
  }

  async list(scope?: string, namespace?: string): Promise<ConfigEntry[]> {
    const pattern = `config:${scope ?? '*'}:${namespace ?? '*'}:*`;
    const result = await this.providers.stateStore.scan<ConfigEntry>({ pattern, count: 500 });
    return result.entries.map(e => e.value);
  }

  invalidateCache(): void { this.cache.clear(); }
  private buildKey(key: string, scope?: string, namespace?: string): string { return `${scope ?? 'global'}:${namespace ?? 'default'}:${key}`; }
}
