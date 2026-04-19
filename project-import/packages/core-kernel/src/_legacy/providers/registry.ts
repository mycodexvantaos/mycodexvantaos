/**
 * CodexvantaOS — ProviderRegistry
 * 
 * The central runtime capability detector and provider manager.
 * Determines at startup which providers are available and
 * wires them into the platform's service layer.
 * 
 * Operational Modes:
 *  - Native Mode: All 12 native providers (zero third-party deps)
 *  - Connected Mode: All providers are external (full cloud integration)
 *  - Hybrid Mode: Mix of native and external per capability
 * 
 * Startup Sequence:
 *  1. Register all available providers (native + external)
 *  2. Detect environment capabilities (env vars, connectivity)
 *  3. Select best provider per capability (external preferred if available)
 *  4. Initialize all selected providers
 *  5. Run healthchecks
 *  6. Expose unified provider interface to the platform
 */

import type { DatabaseProvider } from '../interfaces/database';
import type { StorageProvider } from '../interfaces/storage';
import type { AuthProvider } from '../interfaces/auth';
import type { QueueProvider } from '../interfaces/queue';
import type { StateStoreProvider } from '../interfaces/state-store';
import type { SecretsProvider } from '../interfaces/secrets';
import type { RepoProvider } from '../interfaces/repo';
import type { DeployProvider } from '../interfaces/deploy';
import type { ValidationProvider } from '../interfaces/validation';
import type { SecurityScannerProvider } from '../interfaces/security';
import type { ObservabilityProvider } from '../interfaces/observability';
import type { NotificationProvider } from '../interfaces/notification';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProviderCapability =
  | 'database'
  | 'storage'
  | 'auth'
  | 'queue'
  | 'stateStore'
  | 'secrets'
  | 'repo'
  | 'deploy'
  | 'validation'
  | 'security'
  | 'observability'
  | 'notification';

export type OperationalMode = 'native' | 'connected' | 'hybrid';

export type AnyProvider =
  | DatabaseProvider
  | StorageProvider
  | AuthProvider
  | QueueProvider
  | StateStoreProvider
  | SecretsProvider
  | RepoProvider
  | DeployProvider
  | ValidationProvider
  | SecurityScannerProvider
  | ObservabilityProvider
  | NotificationProvider;

export interface ProviderSlot<T extends AnyProvider = AnyProvider> {
  capability: ProviderCapability;
  native: T;
  external?: T;
  active: T;
  mode: 'native' | 'external';
  healthy: boolean;
}

export interface RegistryStatus {
  mode: OperationalMode;
  initialized: boolean;
  capabilities: Record<ProviderCapability, {
    providerId: string;
    mode: 'native' | 'external';
    healthy: boolean;
  }>;
  healthySummary: { total: number; healthy: number; unhealthy: number };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export class ProviderRegistry {
  private slots = new Map<ProviderCapability, ProviderSlot>();
  private initialized = false;

  /**
   * Register a native (built-in) provider for a capability.
   * Every capability MUST have a native provider.
   */
  registerNative<T extends AnyProvider>(capability: ProviderCapability, provider: T): this {
    const slot = this.slots.get(capability) as ProviderSlot<T> | undefined;
    if (slot) {
      slot.native = provider;
      if (!slot.external) {
        slot.active = provider;
        slot.mode = 'native';
      }
    } else {
      this.slots.set(capability, {
        capability,
        native: provider,
        active: provider,
        mode: 'native',
        healthy: false,
      } as ProviderSlot);
    }
    return this;
  }

  /**
   * Register an external (third-party) provider for a capability.
   * This automatically promotes it to the active provider.
   */
  registerExternal<T extends AnyProvider>(capability: ProviderCapability, provider: T): this {
    const slot = this.slots.get(capability) as ProviderSlot<T> | undefined;
    if (slot) {
      slot.external = provider;
      slot.active = provider;
      slot.mode = 'external';
    } else {
      // No native registered yet — still set external as active
      this.slots.set(capability, {
        capability,
        native: provider, // temporary; native MUST be registered separately
        external: provider,
        active: provider,
        mode: 'external',
        healthy: false,
      } as ProviderSlot);
    }
    return this;
  }

  /**
   * Initialize all registered providers.
   * If an external provider fails to init, falls back to native.
   */
  async initialize(): Promise<void> {
    for (const [capability, slot] of this.slots) {
      // Always init native first (it's the fallback)
      try {
        await slot.native.init();
      } catch (err) {
        console.error(`[Registry] Native provider for ${capability} failed to init:`, err);
      }

      // Init external if registered
      if (slot.external && slot.external !== slot.native) {
        try {
          await slot.external.init();
          slot.active = slot.external;
          slot.mode = 'external';
        } catch (err) {
          console.warn(
            `[Registry] External provider for ${capability} failed to init, falling back to native:`,
            err
          );
          slot.active = slot.native;
          slot.mode = 'native';
        }
      }
    }

    // Run healthchecks
    await this.healthcheckAll();
    this.initialized = true;
  }

  /**
   * Run healthchecks on all active providers.
   * If an external provider becomes unhealthy, auto-fallback to native.
   */
  async healthcheckAll(): Promise<void> {
    for (const [capability, slot] of this.slots) {
      try {
        const health = await (slot.active as any).healthcheck();
        slot.healthy = health.healthy;

        // Auto-fallback: if external is unhealthy and native is different, switch
        if (!health.healthy && slot.mode === 'external' && slot.external !== slot.native) {
          console.warn(
            `[Registry] External provider for ${capability} unhealthy, falling back to native`
          );
          try {
            const nativeHealth = await (slot.native as any).healthcheck();
            if (nativeHealth.healthy) {
              slot.active = slot.native;
              slot.mode = 'native';
              slot.healthy = true;
            }
          } catch {
            // Native also unhealthy — keep current state
          }
        }
      } catch (err) {
        slot.healthy = false;
        console.error(`[Registry] Healthcheck failed for ${capability}:`, err);
      }
    }
  }

  /**
   * Get the active provider for a capability.
   */
  get<T extends AnyProvider>(capability: ProviderCapability): T {
    const slot = this.slots.get(capability);
    if (!slot) {
      throw new Error(`No provider registered for capability: ${capability}`);
    }
    return slot.active as T;
  }

  /**
   * Force switch to native for a capability.
   */
  switchToNative(capability: ProviderCapability): void {
    const slot = this.slots.get(capability);
    if (!slot) throw new Error(`No provider for: ${capability}`);
    slot.active = slot.native;
    slot.mode = 'native';
  }

  /**
   * Force switch to external for a capability (if registered).
   */
  switchToExternal(capability: ProviderCapability): void {
    const slot = this.slots.get(capability);
    if (!slot) throw new Error(`No provider for: ${capability}`);
    if (!slot.external) throw new Error(`No external provider registered for: ${capability}`);
    slot.active = slot.external;
    slot.mode = 'external';
  }

  /**
   * Determine overall operational mode.
   */
  getMode(): OperationalMode {
    let hasNative = false;
    let hasExternal = false;

    for (const slot of this.slots.values()) {
      if (slot.mode === 'native') hasNative = true;
      if (slot.mode === 'external') hasExternal = true;
    }

    if (hasNative && hasExternal) return 'hybrid';
    if (hasExternal) return 'connected';
    return 'native';
  }

  /**
   * Get full registry status.
   */
  status(): RegistryStatus {
    const capabilities: Record<string, any> = {};
    let healthy = 0;
    let unhealthy = 0;

    for (const [cap, slot] of this.slots) {
      capabilities[cap] = {
        providerId: (slot.active as any).providerId,
        mode: slot.mode,
        healthy: slot.healthy,
      };
      if (slot.healthy) healthy++;
      else unhealthy++;
    }

    return {
      mode: this.getMode(),
      initialized: this.initialized,
      capabilities: capabilities as any,
      healthySummary: { total: this.slots.size, healthy, unhealthy },
    };
  }

  /**
   * Gracefully shut down all providers.
   */
  async shutdown(): Promise<void> {
    for (const [capability, slot] of this.slots) {
      try {
        await slot.active.close();
        // Also close the inactive provider if different
        if (slot.external && slot.external !== slot.active) {
          await slot.external.close();
        }
        if (slot.native !== slot.active) {
          await slot.native.close();
        }
      } catch (err) {
        console.error(`[Registry] Error shutting down ${capability}:`, err);
      }
    }
    this.initialized = false;
  }
}

// ─── Singleton Factory ────────────────────────────────────────────────────────

let _registry: ProviderRegistry | null = null;

/**
 * Get or create the global ProviderRegistry singleton.
 */
export function getRegistry(): ProviderRegistry {
  if (!_registry) {
    _registry = new ProviderRegistry();
  }
  return _registry;
}

/**
 * Create a fresh ProviderRegistry (useful for testing).
 */
export function createRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}