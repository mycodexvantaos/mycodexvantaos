/**
 * CodexvantaOS — secret-vault / VaultService
 * In-memory secret storage with scope support
 */

import type { SecretEntry } from "./types";

export interface StoredSecret {
  value: string;
  scope: string;
  namespace?: string;
  version: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class VaultService {
  private secrets = new Map<string, StoredSecret>();

  private makeKey(key: string, scope = "global", namespace?: string): string {
    return namespace ? `${scope}:${namespace}:${key}` : `${scope}:${key}`;
  }

  async setSecret(
    key: string,
    value: string,
    options?: { scope?: string; namespace?: string; tags?: string[] },
  ): Promise<void> {
    const scope = options?.scope ?? "global";
    const compositeKey = this.makeKey(key, scope, options?.namespace);
    const existing = this.secrets.get(compositeKey);
    this.secrets.set(compositeKey, {
      value,
      scope,
      namespace: options?.namespace,
      version: existing ? existing.version + 1 : 1,
      tags: options?.tags ?? existing?.tags ?? [],
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    });
  }

  async getSecret(key: string, scope = "global", namespace?: string): Promise<string | null> {
    const compositeKey = this.makeKey(key, scope, namespace);
    return this.secrets.get(compositeKey)?.value ?? null;
  }

  async deleteSecret(key: string, scope = "global", namespace?: string): Promise<boolean> {
    const compositeKey = this.makeKey(key, scope, namespace);
    return this.secrets.delete(compositeKey);
  }

  async listSecrets(options?: { scope?: string; prefix?: string }): Promise<SecretEntry[]> {
    const entries: SecretEntry[] = [];
    for (const [compositeKey, stored] of this.secrets) {
      if (options?.scope && stored.scope !== options.scope) continue;
      const parts = compositeKey.split(":");
      const rawKey = parts.length > 1 ? parts.slice(stored.namespace ? 2 : 1).join(":") : compositeKey;
      if (options?.prefix && !rawKey.startsWith(options.prefix)) continue;
      entries.push({
        key: rawKey,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
        version: stored.version,
        tags: stored.tags,
      });
    }
    return entries;
  }

  async rotateSecret(
    key: string,
    newValue: string,
    scope = "global",
    namespace?: string,
  ): Promise<{ previousVersion: number; newVersion: number }> {
    const compositeKey = this.makeKey(key, scope, namespace);
    const existing = this.secrets.get(compositeKey);
    const previousVersion = existing?.version ?? 0;
    const newVersion = previousVersion + 1;
    this.secrets.set(compositeKey, {
      value: newValue,
      scope,
      namespace,
      version: newVersion,
      tags: existing?.tags ?? [],
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
      rotatedAt: new Date(),
    } as StoredSecret & { rotatedAt: Date });
    return { previousVersion, newVersion };
  }
}