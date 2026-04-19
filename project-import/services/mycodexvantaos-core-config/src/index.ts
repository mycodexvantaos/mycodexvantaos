/**
 * CodexvantaOS — config-manager
 * 設定管理器 — Layered configuration and feature flags
 *
 * Layer: B-Runtime | Tier: 1
 */
import pino from "pino";

const logger = pino({ name: "config-manager" });

// Re-export types
export * from "./types";

export type ConfigScope = "global" | "service" | "environment";

export interface ConfigEntry {
  key: string;
  value: unknown;
  scope: ConfigScope;
  namespace: string;
  version: number;
  updatedAt: number;
}

/**
 * ConfigService — in-memory layered configuration store
 */
export class ConfigService {
  private store = new Map<string, ConfigEntry>();
  private version = 0;

  private buildKey(key: string, scope: ConfigScope, namespace: string): string {
    return `${scope}:${namespace}:${key}`;
  }

  async get<T = unknown>(
    key: string,
    options?: { scope?: ConfigScope; namespace?: string; defaultValue?: T }
  ): Promise<T | undefined> {
    const scopes: ConfigScope[] = options?.scope
      ? [options.scope]
      : ["environment", "service", "global"];
    const ns = options?.namespace ?? "default";

    for (const scope of scopes) {
      const entry = this.store.get(this.buildKey(key, scope, ns));
      if (entry) return entry.value as T;
    }
    return options?.defaultValue;
  }

  async set(
    key: string,
    value: unknown,
    options?: { scope?: ConfigScope; namespace?: string }
  ): Promise<ConfigEntry> {
    const scope = options?.scope ?? "global";
    const ns = options?.namespace ?? "default";
    const storeKey = this.buildKey(key, scope, ns);

    const entry: ConfigEntry = {
      key,
      value,
      scope,
      namespace: ns,
      version: ++this.version,
      updatedAt: Date.now(),
    };
    this.store.set(storeKey, entry);
    logger.debug({ key, scope, namespace: ns }, "Config set");
    return entry;
  }

  async delete(key: string, options?: { scope?: ConfigScope; namespace?: string }): Promise<boolean> {
    const scope = options?.scope ?? "global";
    const ns = options?.namespace ?? "default";
    return this.store.delete(this.buildKey(key, scope, ns));
  }

  async list(scope?: ConfigScope): Promise<ConfigEntry[]> {
    const entries = Array.from(this.store.values());
    return scope ? entries.filter((e) => e.scope === scope) : entries;
  }
}

/**
 * FeatureFlagService — simple boolean feature flags
 */
export class FeatureFlagService {
  private flags = new Map<string, boolean>();

  isEnabled(flag: string): boolean {
    return this.flags.get(flag) ?? false;
  }

  setFlag(flag: string, enabled: boolean): void {
    this.flags.set(flag, enabled);
    logger.debug({ flag, enabled }, "Feature flag updated");
  }

  listFlags(): Record<string, boolean> {
    return Object.fromEntries(this.flags);
  }
}
