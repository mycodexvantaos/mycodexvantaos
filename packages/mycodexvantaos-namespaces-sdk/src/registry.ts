/**
 * MyCodexVantaOS Provider Registry
 * 
 * Dynamic provider discovery, registration, and lifecycle management
 */

import { 
  BaseProvider, 
  ProviderCapability, 
  ProviderRegistryEntry, 
  HealthCheckResult,
  ProviderSource,
  ProviderCriticality
} from './types';
import { MyCodexVantaOSValidator } from '@mycodexvantaos/taxonomy-core';

/**
 * MyCodexVantaOS Provider Registry
 * 
 * Manages provider lifecycle, health checks, and availability
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, ProviderRegistryEntry> = new Map();
  private capabilityToProviders: Map<ProviderCapability, ProviderRegistryEntry[]> = new Map();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  /**
   * Register a provider
   */
  register(provider: BaseProvider, providerName: string): void {
    // Validate capability is canonical
    const capabilityValidation = MyCodexVantaOSValidator.validateCapabilityId(provider.capability);
    if (!capabilityValidation.valid) {
      throw new Error(`Invalid provider capability: ${provider.capability}`);
    }

    const entry: ProviderRegistryEntry = {
      providerName,
      capability: provider.capability,
      source: provider.source,
      criticality: provider.criticality,
      supportsModes: provider.supportsModes,
      instance: provider,
      initialized: false,
      health: 'unknown'
    };

    this.providers.set(providerName, entry);
    
    // Update capability index
    if (!this.capabilityToProviders.has(provider.capability)) {
      this.capabilityToProviders.set(provider.capability, []);
    }
    this.capabilityToProviders.get(provider.capability)!.push(entry);
  }

  /**
   * Unregister a provider
   */
  unregister(providerName: string): void {
    const entry = this.providers.get(providerName);
    if (entry) {
      // Shutdown if initialized
      if (entry.initialized && entry.instance.shutdown) {
        entry.instance.shutdown();
      }
      
      // Remove from capability index
      const providers = this.capabilityToProviders.get(entry.capability);
      if (providers) {
        const index = providers.findIndex(p => p.providerName === providerName);
        if (index !== -1) {
          providers.splice(index, 1);
        }
      }
      
      this.providers.delete(providerName);
    }
  }

  /**
   * Get a registered provider
   */
  get(providerName: string): BaseProvider | undefined {
    const entry = this.providers.get(providerName);
    return entry?.instance;
  }

  /**
   * Get all providers for a capability
   */
  getByCapability(capability: ProviderCapability): BaseProvider[] {
    const entries = this.capabilityToProviders.get(capability) || [];
    return entries.map(entry => entry.instance);
  }

  /**
   * Get provider by capability (first available)
   */
  getByCapabilityFirst(capability: ProviderCapability): BaseProvider | undefined {
    const providers = this.getByCapability(capability);
    return providers[0];
  }

  /**
   * Get provider by capability and source preference
   */
  getByCapabilityAndSource(
    capability: ProviderCapability, 
    preferredSource: ProviderSource
  ): BaseProvider | undefined {
    const entries = this.capabilityToProviders.get(capability) || [];
    
    // Try to find preferred source
    let entry = entries.find(e => e.source === preferredSource);
    if (entry) {
      return entry.instance;
    }
    
    // Fallback to any provider
    return entries[0]?.instance;
  }

  /**
   * List all registered providers
   */
  list(): ProviderRegistryEntry[] {
    return Array.from(this.providers.values());
  }

  /**
   * List providers by capability
   */
  listByCapability(capability: ProviderCapability): ProviderRegistryEntry[] {
    return this.capabilityToProviders.get(capability) || [];
  }

  /**
   * Check if a provider is registered
   */
  has(providerName: string): boolean {
    return this.providers.has(providerName);
  }

  /**
   * Check if any provider is available for a capability
   */
  hasCapability(capability: ProviderCapability): boolean {
    const providers = this.capabilityToProviders.get(capability);
    return providers !== undefined && providers.length > 0;
  }

  /**
   * Initialize a provider
   */
  async initialize(providerName: string, config?: unknown): Promise<void> {
    const entry = this.providers.get(providerName);
    if (!entry) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    if (entry.initialized) {
      return;
    }

    if (entry.instance.initialize) {
      await entry.instance.initialize(config);
    }
    
    entry.initialized = true;
  }

  /**
   * Initialize all registered providers
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.providers.values()).map(entry => {
      if (!entry.initialized && entry.instance.initialize) {
        return entry.instance.initialize().then(() => {
          entry.initialized = true;
        });
      }
      return Promise.resolve();
    });
    
    await Promise.all(initPromises);
  }

  /**
   * Perform health check on a provider
   */
  async healthCheck(providerName: string): Promise<HealthCheckResult> {
    const entry = this.providers.get(providerName);
    if (!entry) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    const result = await entry.instance.healthCheck();
    entry.health = result.status;
    
    return result;
  }

  /**
   * Perform health check on all providers
   */
  async healthCheckAll(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();
    
    for (const [providerName, entry] of this.providers) {
      try {
        const result = await entry.instance.healthCheck();
        results.set(providerName, result);
        entry.health = result.status;
      } catch (error) {
        results.set(providerName, {
          status: 'unhealthy',
          timestamp: new Date(),
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        entry.health = 'unhealthy';
      }
    }
    
    return results;
  }

  /**
   * Get healthy providers for a capability
   */
  getHealthyProviders(capability: ProviderCapability): BaseProvider[] {
    const entries = this.capabilityToProviders.get(capability) || [];
    return entries
      .filter(entry => entry.health === 'healthy' || entry.health === 'unknown')
      .map(entry => entry.instance);
  }

  /**
   * Get provider registry statistics
   */
  getStats(): {
    total: number;
    initialized: number;
    healthy: number;
    unhealthy: number;
    unknown: number;
    byCapability: Record<ProviderCapability, number>;
  } {
    const entries = Array.from(this.providers.values());
    const byCapability: Record<string, number> = {};
    
    for (const entry of entries) {
      byCapability[entry.capability] = (byCapability[entry.capability] || 0) + 1;
    }
    
    return {
      total: entries.length,
      initialized: entries.filter(e => e.initialized).length,
      healthy: entries.filter(e => e.health === 'healthy').length,
      unhealthy: entries.filter(e => e.health === 'unhealthy').length,
      unknown: entries.filter(e => e.health === 'unknown').length,
      byCapability: byCapability as Record<ProviderCapability, number>
    };
  }

  /**
   * Clear all registered providers (useful for testing)
   */
  clear(): void {
    for (const entry of this.providers.values()) {
      if (entry.initialized && entry.instance.shutdown) {
        entry.instance.shutdown();
      }
    }
    this.providers.clear();
    this.capabilityToProviders.clear();
  }

  /**
   * Shutdown all providers
   */
  async shutdownAll(): Promise<void> {
    const shutdownPromises = Array.from(this.providers.values())
      .filter(entry => entry.initialized && entry.instance.shutdown)
      .map(entry => entry.instance.shutdown!());
    
    await Promise.all(shutdownPromises);
    
    // Reset state
    for (const entry of this.providers.values()) {
      entry.initialized = false;
      entry.health = 'unknown';
    }
  }
}