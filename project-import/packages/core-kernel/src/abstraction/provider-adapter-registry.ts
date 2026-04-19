/**
 * Provider Adapter Registry
 * 
 * Central registry for managing provider adapters across all capabilities.
 * Handles adapter registration, resolution, and runtime mode-based filtering.
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import {
  ProviderAdapter,
  ProviderAdapterFactory,
  ProviderAdapterMetadata,
  AdapterConfiguration,
  AdapterHealthStatus
} from './provider-adapter.interface';
import { ProviderHealthStatus } from '../interfaces/runtime';

const logger = pino({ name: 'provider-adapter-registry' });

export interface AdapterRegistration {
  adapter: ProviderAdapter;
  metadata: ProviderAdapterMetadata;
  config: AdapterConfiguration;
  status: 'registered' | 'active' | 'inactive' | 'error';
  registeredAt: Date;
  lastHealthCheck: Date;
}

export class ProviderAdapterRegistry extends EventEmitter {
  private adapters: Map<string, AdapterRegistration> = new Map();
  private factories: Map<string, ProviderAdapterFactory> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map();
  private runtimeModeIndex: Map<string, Set<string>> = new Map();

  /**
   * Register an adapter factory
   */
  registerFactory(factory: ProviderAdapterFactory): void {
    const metadata = factory.getMetadata();
    
    if (!metadata.name || !metadata.capability) {
      throw new Error('Factory metadata missing required fields');
    }

    this.factories.set(metadata.name, factory);
    
    logger.info({ 
      factory: metadata.name, 
      capability: metadata.capability 
    }, 'Adapter factory registered');
  }

  /**
   * Register an adapter instance
   */
  async registerAdapter(
    adapter: ProviderAdapter,
    config: AdapterConfiguration
  ): Promise<void> {
    logger.info({ 
      adapter: adapter.name, 
      capability: adapter.capability 
    }, 'Registering provider adapter');

    try {
      // Create metadata
      const metadata: ProviderAdapterMetadata = {
        name: adapter.name,
        capability: adapter.capability,
        version: '1.0.0',
        supportedRuntimeModes: adapter.runtimeModes
      };

      // Initialize adapter
      await adapter.initialize(config.config);

      // Create registration
      const registration: AdapterRegistration = {
        adapter,
        metadata,
        config,
        status: 'active',
        registeredAt: new Date(),
        lastHealthCheck: new Date()
      };

      // Store registration
      this.adapters.set(adapter.name, registration);

      // Update indexes
      this.updateCapabilityIndex(adapter.capability, adapter.name);
      this.updateRuntimeModeIndex(adapter.runtimeModes, adapter.name);

      // Emit registration event
      this.emit('adapter:registered', { 
        adapter: adapter.name, 
        capability: adapter.capability 
      });

      logger.info({ adapter: adapter.name }, 'Provider adapter registered successfully');
    } catch (error) {
      logger.error({ adapter: adapter.name, error }, 'Provider adapter registration failed');
      throw error;
    }
  }

  /**
   * Create and register an adapter from factory
   */
  async createAdapter(config: AdapterConfiguration): Promise<ProviderAdapter> {
    logger.info({ 
      capability: config.capability,
      implementation: config.implementation 
    }, 'Creating adapter from factory');

    const factory = this.factories.get(config.implementation);
    if (!factory) {
      throw new Error(`Factory not found for implementation: ${config.implementation}`);
    }

    // Validate configuration
    if (!factory.validateConfig(config.config)) {
      throw new Error('Invalid configuration for adapter factory');
    }

    // Create adapter
    const adapter = factory.createAdapter(config.config);

    // Register adapter
    await this.registerAdapter(adapter, config);

    return adapter;
  }

  /**
   * Resolve adapters for a capability
   */
  resolveAdapters(
    capability: string,
    options?: {
      runtimeMode?: 'native' | 'connected' | 'hybrid' | 'auto';
      preferredAdapter?: string;
    }
  ): ProviderAdapter[] {
    logger.debug({ capability, options }, 'Resolving adapters');

    const adapterNames = this.capabilityIndex.get(capability);
    if (!adapterNames) {
      return [];
    }

    const adapters: ProviderAdapter[] = [];

    for (const name of adapterNames) {
      const registration = this.adapters.get(name);
      if (!registration || registration.status !== 'active') {
        continue;
      }

      // Filter by runtime mode if specified
      if (options?.runtimeMode) {
        if (!registration.adapter.runtimeModes.includes(options.runtimeMode)) {
          continue;
        }
      }

      adapters.push(registration.adapter);
    }

    // Sort by priority if preferred adapter not specified
    if (options?.preferredAdapter) {
      const preferred = adapters.find(a => a.name === options.preferredAdapter);
      if (preferred) {
        return [preferred];
      }
    }

    // Sort by config priority
    adapters.sort((a, b) => {
      const regA = this.adapters.get(a.name)!;
      const regB = this.adapters.get(b.name)!;
      return regB.config.priority - regA.config.priority;
    });

    return adapters;
  }

  /**
   * Get an adapter by name
   */
  getAdapter(name: string): ProviderAdapter | undefined {
    const registration = this.adapters.get(name);
    return registration?.adapter;
  }

  /**
   * Get adapter registration
   */
  getAdapterRegistration(name: string): AdapterRegistration | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get all adapters
   */
  getAllAdapters(): ProviderAdapter[] {
    return Array.from(this.adapters.values())
      .filter(reg => reg.status === 'active')
      .map(reg => reg.adapter);
  }

  /**
   * Get adapters by runtime mode
   */
  getAdaptersByRuntimeMode(runtimeMode: string): ProviderAdapter[] {
    const adapterNames = this.runtimeModeIndex.get(runtimeMode);
    if (!adapterNames) {
      return [];
    }

    const adapters: ProviderAdapter[] = [];

    for (const name of adapterNames) {
      const registration = this.adapters.get(name);
      if (registration && registration.status === 'active') {
        adapters.push(registration.adapter);
      }
    }

    return adapters;
  }

  /**
   * Perform health checks on all adapters
   */
  async performHealthChecks(): Promise<Map<string, AdapterHealthStatus>> {
    const results = new Map<string, AdapterHealthStatus>();

    for (const [name, registration] of this.adapters) {
      try {
        const isHealthy = await registration.adapter.healthCheck();
        
        registration.lastHealthCheck = new Date();
        registration.status = isHealthy ? 'active' : 'inactive';

        const healthStatus: AdapterHealthStatus = {
          adapterName: name,
          status: isHealthy ? ProviderHealthStatus.HEALTHY : ProviderHealthStatus.UNHEALTHY,
          timestamp: registration.lastHealthCheck
        };

        results.set(name, healthStatus);

        if (!isHealthy) {
          logger.warn({ adapter: name }, 'Adapter health check failed');
          this.emit('adapter:health-failed', { adapter: name });
        }
      } catch (error) {
        registration.status = 'error';
        registration.lastHealthCheck = new Date();

        const healthStatus: AdapterHealthStatus = {
          adapterName: name,
          status: ProviderHealthStatus.UNHEALTHY,
          timestamp: registration.lastHealthCheck,
          message: error instanceof Error ? error.message : 'Unknown error'
        };

        results.set(name, healthStatus);

        logger.error({ adapter: name, error }, 'Adapter health check failed with error');
        this.emit('adapter:health-failed', { adapter: name, error });
      }
    }

    return results;
  }

  /**
   * Unregister an adapter
   */
  async unregisterAdapter(name: string): Promise<boolean> {
    const registration = this.adapters.get(name);
    if (!registration) {
      return false;
    }

    try {
      // Shutdown adapter
      await registration.adapter.shutdown();

      // Remove from registry
      this.adapters.delete(name);

      // Remove from indexes
      this.removeFromCapabilityIndex(registration.adapter.capability, name);
      this.removeFromRuntimeModeIndex(registration.adapter.runtimeModes, name);

      // Emit unregistration event
      this.emit('adapter:unregistered', { adapter: name });

      logger.info({ adapter: name }, 'Adapter unregistered successfully');
      return true;
    } catch (error) {
      logger.error({ adapter: name, error }, 'Adapter unregistration failed');
      throw error;
    }
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalAdapters: number;
    activeAdapters: number;
    inactiveAdapters: number;
    errorAdapters: number;
    adaptersByCapability: Record<string, number>;
  } {
    const stats = {
      totalAdapters: this.adapters.size,
      activeAdapters: 0,
      inactiveAdapters: 0,
      errorAdapters: 0,
      adaptersByCapability: {} as Record<string, number>
    };

    for (const registration of this.adapters.values()) {
      switch (registration.status) {
        case 'active':
          stats.activeAdapters++;
          break;
        case 'inactive':
          stats.inactiveAdapters++;
          break;
        case 'error':
          stats.errorAdapters++;
          break;
      }

      const cap = registration.adapter.capability;
      stats.adaptersByCapability[cap] = (stats.adaptersByCapability[cap] || 0) + 1;
    }

    return stats;
  }

  /**
   * Update capability index
   */
  private updateCapabilityIndex(capability: string, adapterName: string): void {
    if (!this.capabilityIndex.has(capability)) {
      this.capabilityIndex.set(capability, new Set());
    }
    this.capabilityIndex.get(capability)!.add(adapterName);
  }

  /**
   * Update runtime mode index
   */
  private updateRuntimeModeIndex(runtimeModes: string[], adapterName: string): void {
    for (const mode of runtimeModes) {
      if (!this.runtimeModeIndex.has(mode)) {
        this.runtimeModeIndex.set(mode, new Set());
      }
      this.runtimeModeIndex.get(mode)!.add(adapterName);
    }
  }

  /**
   * Remove from capability index
   */
  private removeFromCapabilityIndex(capability: string, adapterName: string): void {
    const adapterNames = this.capabilityIndex.get(capability);
    if (adapterNames) {
      adapterNames.delete(adapterName);
      if (adapterNames.size === 0) {
        this.capabilityIndex.delete(capability);
      }
    }
  }

  /**
   * Remove from runtime mode index
   */
  private removeFromRuntimeModeIndex(runtimeModes: string[], adapterName: string): void {
    for (const mode of runtimeModes) {
      const adapterNames = this.runtimeModeIndex.get(mode);
      if (adapterNames) {
        adapterNames.delete(adapterName);
        if (adapterNames.size === 0) {
          this.runtimeModeIndex.delete(mode);
        }
      }
    }
  }

  /**
   * Clear all adapters
   */
  async clearAdapters(): Promise<void> {
    logger.info('Clearing all adapters');

    // Unregister all adapters
    const adapterNames = Array.from(this.adapters.keys());
    for (const name of adapterNames) {
      try {
        await this.unregisterAdapter(name);
      } catch (error) {
        logger.error({ adapter: name, error }, 'Failed to unregister adapter during clear');
      }
    }

    this.emit('adapters:cleared', { count: adapterNames.length });
    logger.info('All adapters cleared');
  }
}

// Export singleton instance
export const providerAdapterRegistry = new ProviderAdapterRegistry();