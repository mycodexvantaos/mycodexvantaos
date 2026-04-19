/**
 * CodexvantaOS — secret-vault / VaultService
 * Secret management facade over SecretsProvider
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export class VaultService {
  private get providers() { return getProviders(); }

  async setSecret(key: string, value: string, options?: {
    scope?: 'global' | 'repository' | 'environment' | 'user'; namespace?: string;
    expiresAt?: number; tags?: Record<string, string>;
  }): Promise<void> {
    await this.providers.secrets.set(key, value, { scope: options?.scope, namespace: options?.namespace, expiresAt: options?.expiresAt, tags: options?.tags });
    this.providers.observability.info('Secret stored', { key, scope: options?.scope ?? 'global' });
  }

  async getSecret(key: string, scope?: 'global' | 'repository' | 'environment' | 'user', namespace?: string): Promise<string | null> {
    const result = await this.providers.secrets.get(key, scope, namespace);
    return result?.value ?? null;
  }

  async deleteSecret(key: string, scope?: 'global' | 'repository' | 'environment' | 'user', namespace?: string): Promise<boolean> {
    const deleted = await this.providers.secrets.delete(key, scope, namespace);
    if (deleted) this.providers.observability.info('Secret deleted', { key });
    return deleted;
  }

  async listSecrets(options?: { scope?: 'global' | 'repository' | 'environment' | 'user'; namespace?: string; prefix?: string }): Promise<Array<{ key: string; scope: string; updatedAt: number }>> {
    const metas = await this.providers.secrets.list(options);
    return metas.map(m => ({ key: m.key, scope: m.scope, updatedAt: m.updatedAt }));
  }

  async rotateSecret(key: string, newValue: string, scope?: 'global' | 'repository' | 'environment' | 'user', namespace?: string): Promise<{ previousVersion: number; newVersion: number }> {
    const result = await this.providers.secrets.rotate(key, newValue, scope, namespace);
    this.providers.observability.info('Secret rotated', { key, newVersion: result.newVersion });
    return { previousVersion: result.previousVersion, newVersion: result.newVersion };
  }

  async resolveSecrets(keys: Array<{ key: string; scope?: 'global' | 'repository' | 'environment' | 'user'; namespace?: string }>): Promise<Record<string, string>> {
    if (this.providers.secrets.resolveMany) {
      const map = await this.providers.secrets.resolveMany(keys);
      return Object.fromEntries(map);
    }
    const result: Record<string, string> = {};
    for (const { key, scope, namespace } of keys) {
      const value = await this.getSecret(key, scope, namespace);
      if (value !== null) result[key] = value;
    }
    return result;
  }
}
