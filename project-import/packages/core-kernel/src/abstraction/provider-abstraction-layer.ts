/**
 * Provider Abstraction Layer
 * 
 * High-level service that provides a unified interface for working with providers
 * across different capabilities and runtime modes. Implements the cloud-agnostic
 * provider selection and runtime mode switching logic.
 */

import pino from 'pino';
import { ProviderAdapterRegistry } from './provider-adapter-registry';
import { ProviderAdapter, AdapterConfiguration } from './provider-adapter.interface';
import { ProviderRegistryService } from '../runtime/provider-registry.service';
import { ProviderCapability } from '../interfaces';

const logger = pino({ name: 'provider-abstraction-layer' });

export interface ProviderResolutionOptions {
  capability: ProviderCapability;
  runtimeMode?: 'native' | 'connected' | 'hybrid' | 'auto';
  preferredProvider?: string;
  fallbackEnabled?: boolean;
  context?: {
    serviceName?: string;
    environment?: string;
    tenantId?: string;
  };
}

export interface ProviderResolutionResult {
  adapter: ProviderAdapter;
  capability: string;
  runtimeMode: string;
  timestamp: Date;
  fallbackUsed: boolean;
  metadata?: any;
}

export class ProviderAbstractionLayer {
  private adapterRegistry: ProviderAdapterRegistry;
  private providerRegistry: ProviderRegistryService;

  constructor(
    adapterRegistry?: ProviderAdapterRegistry,
    providerRegistry?: ProviderRegistryService
  ) {
    this.adapterRegistry = adapterRegistry || new ProviderAdapterRegistry();
    this.providerRegistry = providerRegistry || new ProviderRegistryService();
  }

  /**
   * Initialize the abstraction layer
   */
  async initialize(): Promise<void> {
    logger.info('Initializing provider abstraction layer');

    try {
      await this.adapterRegistry.performHealthChecks();
      
      logger.info('Provider abstraction layer initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize provider abstraction layer');
      throw error;
    }
  }

  /**
   * Resolve a provider for a specific capability
   */
  async resolveProvider(
    options: ProviderResolutionOptions
  ): Promise<ProviderResolutionResult> {
    logger.info({ 
      capability: options.capability,
      runtimeMode: options.runtimeMode 
    }, 'Resolving provider');

    try {
      // Resolve adapters using adapter registry
      const adapters = this.adapterRegistry.resolveAdapters(
        options.capability,
        {
          runtimeMode: options.runtimeMode,
          preferredAdapter: options.preferredProvider
        }
      );

      if (adapters.length === 0) {
        throw new Error(`No adapters available for capability: ${options.capability}`);
      }

      // Select primary adapter
      let selectedAdapter = adapters[0];
      let fallbackUsed = false;

      // Check if primary adapter is healthy
      const isHealthy = await selectedAdapter.healthCheck();
      
      if (!isHealthy && options.fallbackEnabled !== false) {
        logger.warn({ 
          adapter: selectedAdapter.name,
          capability: options.capability 
        }, 'Primary adapter unhealthy, attempting fallback');

        // Try fallback adapters
        for (let i = 1; i < adapters.length; i++) {
          const fallbackAdapter = adapters[i];
          const fallbackHealthy = await fallbackAdapter.healthCheck();

          if (fallbackHealthy) {
            selectedAdapter = fallbackAdapter;
            fallbackUsed = true;
            
            logger.info({ 
              primary: adapters[0].name,
              fallback: selectedAdapter.name,
              capability: options.capability 
            }, 'Fallback adapter selected');
            
            break;
          }
        }

        // If all adapters are unhealthy
        if (!fallbackUsed && !isHealthy) {
          throw new Error(
            `All adapters for capability ${options.capability} are unhealthy`
          );
        }
      }

      const result: ProviderResolutionResult = {
        adapter: selectedAdapter,
        capability: options.capability,
        runtimeMode: options.runtimeMode || 'auto',
        timestamp: new Date(),
        fallbackUsed,
        metadata: {
          serviceName: options.context?.serviceName,
          environment: options.context?.environment,
          tenantId: options.context?.tenantId
        }
      };

      logger.info({ 
        adapter: selectedAdapter.name,
        capability: options.capability,
        fallbackUsed 
      }, 'Provider resolved successfully');

      return result;
    } catch (error) {
      logger.error({ 
        capability: options.capability,
        error 
      }, 'Provider resolution failed');
      throw error;
    }
  }

  /**
   * Register a provider adapter
   */
  async registerProviderAdapter(config: AdapterConfiguration): Promise<ProviderAdapter> {
    logger.info({ 
      capability: config.capability,
      implementation: config.implementation 
    }, 'Registering provider adapter');

    try {
      const adapter = await this.adapterRegistry.createAdapter(config);
      
      logger.info({ 
        adapter: adapter.name,
        capability: config.capability 
      }, 'Provider adapter registered successfully');

      return adapter;
    } catch (error) {
      logger.error({ 
        capability: config.capability,
        error 
      }, 'Provider adapter registration failed');
      throw error;
    }
  }

  /**
   * Unregister a provider adapter
   */
  async unregisterProviderAdapter(adapterName: string): Promise<void> {
    logger.info({ adapter: adapterName }, 'Unregistering provider adapter');

    try {
      await this.adapterRegistry.unregisterAdapter(adapterName);
      
      logger.info({ adapter: adapterName }, 'Provider adapter unregistered successfully');
    } catch (error) {
      logger.error({ 
        adapter: adapterName,
        error 
      }, 'Provider adapter unregistration failed');
      throw error;
    }
  }

  /**
   * Get available providers for a capability
   */
  getAvailableProviders(
    capability: ProviderCapability,
    runtimeMode?: 'native' | 'connected' | 'hybrid' | 'auto'
  ): ProviderAdapter[] {
    return this.adapterRegistry.resolveAdapters(capability, { runtimeMode });
  }

  /**
   * Perform health check on all providers
   */
  async performHealthChecks(): Promise<Map<string, any>> {
    logger.info('Performing health checks on all providers');

    const results = await this.adapterRegistry.performHealthChecks();

    const healthy = Array.from(results.values()).filter(
      r => r.status === 'healthy'
    ).length;

    const unhealthy = results.size - healthy;

    logger.info({ 
      total: results.size,
      healthy,
      unhealthy 
    }, 'Health checks completed');

    return results;
  }

  /**
   * Get abstraction layer statistics
   */
  getStatistics(): {
    totalAdapters: number;
    activeAdapters: number;
    adaptersByCapability: Record<string, number>;
    capabilitiesSupported: string[];
  } {
    const stats = this.adapterRegistry.getStatistics();

    return {
      totalAdapters: stats.totalAdapters,
      activeAdapters: stats.activeAdapters,
      adaptersByCapability: stats.adaptersByCapability,
      capabilitiesSupported: Object.keys(stats.adaptersByCapability)
    };
  }

  /**
   * Reconfigure a provider
   */
  async reconfigureProvider(
    adapterName: string,
    newConfig: Record<string, any>
  ): Promise<void> {
    logger.info({ adapter: adapterName }, 'Reconfiguring provider');

    const adapter = this.adapterRegistry.getAdapter(adapterName);
    if (!adapter) {
      throw new Error(`Adapter not found: ${adapterName}`);
    }

    if (typeof adapter.reconfigure !== 'function') {
      throw new Error(`Adapter ${adapterName} does not support reconfigure`);
    }

    try {
      await adapter.reconfigure!(newConfig);
      
      logger.info({ adapter: adapterName }, 'Provider reconfigured successfully');
    } catch (error) {
      logger.error({ 
        adapter: adapterName,
        error 
      }, 'Provider reconfiguration failed');
      throw error;
    }
  }

  /**
   * Shutdown all providers
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down provider abstraction layer');

    try {
      await this.adapterRegistry.clearAdapters();
      
      logger.info('Provider abstraction layer shut down successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to shutdown provider abstraction layer');
      throw error;
    }
  }
}

// Export singleton instance
export const providerAbstractionLayer = new ProviderAbstractionLayer();