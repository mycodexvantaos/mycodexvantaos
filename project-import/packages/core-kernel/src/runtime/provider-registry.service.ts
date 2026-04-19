/**
 * ProviderRegistryService — Centralized Provider Management
 * 
 * This service serves as the central runtime component for managing all providers
 * within the MyCodexvantaOS platform. It implements the provider discovery,
 * lifecycle management, capability resolution, and fallback mechanisms defined
 * in the provider-chain architecture.
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import {
  Provider,
  ProviderCapability,
  ProviderHealthStatus,
  ProviderMetadata
} from '../interfaces';

const logger = pino({ name: 'provider-registry-service' });

export interface ProviderConfig {
  name: string;
  capability: ProviderCapability;
  implementation: any;
  priority: number;
  runtimeModes: ('native' | 'connected' | 'hybrid' | 'auto')[];
  config?: Record<string, any>;
}

export interface ProviderRegistration {
  provider: Provider;
  metadata: ProviderMetadata;
  healthStatus: ProviderHealthStatus;
  lastHealthCheck: Date;
  isActive: boolean;
}

export class ProviderRegistryService extends EventEmitter {
  private providers = new Map<string, ProviderRegistration>();
  private capabilityIndex = new Map<ProviderCapability, Set<string>>();
  private runtimeModeIndex = new Map<string, Set<string>>();
  private fallbackChains = new Map<ProviderCapability, string[]>();

  constructor() {
    super();
    this.setupFallbackChains();
  }

  /**
   * Register a new provider with the registry
   */
  async registerProvider(config: ProviderConfig): Promise<void> {
    logger.info({ capability: config.capability, name: config.name }, 'Registering provider');

    // Validate provider implementation
    if (!config.implementation) {
      throw new Error(`Provider implementation is required for ${config.name}`);
    }

    // Create metadata
    const metadata: ProviderMetadata = {
      name: config.name,
      capability: config.capability,
      version: '1.0.0',
      priority: config.priority,
      runtimeModes: config.runtimeModes,
      registeredAt: new Date()
    };

    // Create provider wrapper
    const provider: Provider = {
      name: config.name,
      capability: config.capability,
      initialize: async () => {
        logger.debug({ provider: config.name }, 'Initializing provider');
        if (config.implementation.initialize) {
          await config.implementation.initialize(config.config);
        }
      },
      healthCheck: async () => {
        if (config.implementation.healthCheck) {
          return await config.implementation.healthCheck();
        }
        return true;
      }
    };

    // Create registration
    const registration: ProviderRegistration = {
      provider,
      metadata,
      healthStatus: ProviderHealthStatus.UNKNOWN,
      lastHealthCheck: new Date(),
      isActive: false
    };

    // Store registration
    this.providers.set(config.name, registration);

    // Update indexes
    this.updateCapabilityIndex(config.capability, config.name);
    this.updateRuntimeModeIndex(config.runtimeModes, config.name);

    // Emit registration event
    this.emit('provider:registered', { provider: config.name, capability: config.capability });
  }

  /**
   * Resolve a provider for a specific capability
   */
  async resolveProvider(capability: ProviderCapability, options?: {
    preferredProvider?: string;
    runtimeMode?: 'native' | 'connected' | 'hybrid' | 'auto';
  }): Promise<Provider> {
    logger.debug({ capability, options }, 'Resolving provider');

    const candidates = this.getProvidersForCapability(capability, options);

    if (candidates.length === 0) {
      throw new Error(`No providers available for capability: ${capability}`);
    }

    // Filter by preferred provider if specified
    if (options?.preferredProvider) {
      const preferred = candidates.find(r => r.metadata.name === options.preferredProvider);
      if (preferred && this.isProviderAvailable(preferred)) {
        return preferred.provider;
      }
    }

    // Find first available provider by priority
    const available = candidates.filter(r => this.isProviderAvailable(r));
    if (available.length === 0) {
      throw new Error(`No healthy providers available for capability: ${capability}`);
    }

    // Sort by priority (higher priority first)
    available.sort((a, b) => b.metadata.priority - a.metadata.priority);

    return available[0].provider;
  }

  /**
   * Get all providers for a specific capability
   */
  getProvidersForCapability(
    capability: ProviderCapability,
    options?: { runtimeMode?: 'native' | 'connected' | 'hybrid' | 'auto' }
  ): ProviderRegistration[] {
    const providerNames = this.capabilityIndex.get(capability);
    if (!providerNames) {
      return [];
    }

    const registrations: ProviderRegistration[] = [];
    for (const name of providerNames) {
      const registration = this.providers.get(name);
      if (registration) {
        // Filter by runtime mode if specified
        if (options?.runtimeMode) {
          if (registration.metadata.runtimeModes.includes(options.runtimeMode)) {
            registrations.push(registration);
          }
        } else {
          registrations.push(registration);
        }
      }
    }

    return registrations;
  }

  /**
   * Get fallback provider for a specific capability
   */
  async getFallbackProvider(capability: ProviderCapability, failedProvider: string): Promise<Provider | null> {
    logger.info({ capability, failedProvider }, 'Getting fallback provider');

    const fallbackChain = this.fallbackChains.get(capability);
    if (!fallbackChain || fallbackChain.length === 0) {
      logger.warn({ capability }, 'No fallback chain configured');
      return null;
    }

    // Find next available provider in the fallback chain
    const failedIndex = fallbackChain.indexOf(failedProvider);
    const candidates = failedIndex >= 0 
      ? fallbackChain.slice(failedIndex + 1)
      : fallbackChain;

    for (const candidateName of candidates) {
      const registration = this.providers.get(candidateName);
      if (registration && this.isProviderAvailable(registration)) {
        logger.info({ 
          capability, 
          failedProvider, 
          fallbackProvider: candidateName 
        }, 'Found fallback provider');
        return registration.provider;
      }
    }

    logger.warn({ capability, failedProvider }, 'No available fallback providers');
    return null;
  }

  /**
   * Perform health check on all providers
   */
  async performHealthChecks(): Promise<Map<string, ProviderHealthStatus>> {
    const results = new Map<string, ProviderHealthStatus>();

    for (const [name, registration] of this.providers) {
      try {
        const isHealthy = await registration.provider.healthCheck();
        const status = isHealthy ? ProviderHealthStatus.HEALTHY : ProviderHealthStatus.UNHEALTHY;
        
        registration.healthStatus = status;
        registration.lastHealthCheck = new Date();
        registration.isActive = isHealthy;
        
        results.set(name, status);
        
        logger.debug({ provider: name, status }, 'Health check completed');
      } catch (error) {
        registration.healthStatus = ProviderHealthStatus.UNHEALTHY;
        registration.lastHealthCheck = new Date();
        registration.isActive = false;
        
        results.set(name, ProviderHealthStatus.UNHEALTHY);
        
        logger.error({ provider: name, error }, 'Health check failed');
        
        // Emit health check failure event
        this.emit('provider:health-failed', { provider: name, error });
      }
    }

    return results;
  }

  /**
   * Initialize all registered providers
   */
  async initializeAllProviders(): Promise<void> {
    logger.info('Initializing all providers');

    const initPromises = Array.from(this.providers.values()).map(async (registration) => {
      try {
        await registration.provider.initialize();
        registration.isActive = true;
        logger.info({ provider: registration.metadata.name }, 'Provider initialized');
      } catch (error) {
        logger.error({ provider: registration.metadata.name, error }, 'Provider initialization failed');
        registration.isActive = false;
        throw error;
      }
    });

    await Promise.all(initPromises);
    
    // Perform initial health checks
    await this.performHealthChecks();
  }

  /**
   * Get provider metadata
   */
  getProviderMetadata(providerName: string): ProviderMetadata | undefined {
    const registration = this.providers.get(providerName);
    return registration?.metadata;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): ProviderRegistration[] {
    return Array.from(this.providers.values());
  }

  /**
   * Get providers by runtime mode
   */
  getProvidersByRuntimeMode(runtimeMode: string): ProviderRegistration[] {
    const providerNames = this.runtimeModeIndex.get(runtimeMode);
    if (!providerNames) {
      return [];
    }

    const registrations: ProviderRegistration[] = [];
    for (const name of providerNames) {
      const registration = this.providers.get(name);
      if (registration) {
        registrations.push(registration);
      }
    }

    return registrations;
  }

  /**
   * Update capability index
   */
  private updateCapabilityIndex(capability: ProviderCapability, providerName: string): void {
    if (!this.capabilityIndex.has(capability)) {
      this.capabilityIndex.set(capability, new Set());
    }
    this.capabilityIndex.get(capability)!.add(providerName);
  }

  /**
   * Update runtime mode index
   */
  private updateRuntimeModeIndex(runtimeModes: string[], providerName: string): void {
    for (const mode of runtimeModes) {
      if (!this.runtimeModeIndex.has(mode)) {
        this.runtimeModeIndex.set(mode, new Set());
      }
      this.runtimeModeIndex.get(mode)!.add(providerName);
    }
  }

  /**
   * Check if provider is available
   */
  private isProviderAvailable(registration: ProviderRegistration): boolean {
    return registration.isActive && registration.healthStatus === ProviderHealthStatus.HEALTHY;
  }

  /**
   * Setup default fallback chains
   */
  private setupFallbackChains(): void {
    // Define fallback chains for each capability
    // Priority-based fallback: higher priority providers are tried first
    this.fallbackChains.set('database', []);
    this.fallbackChains.set('storage', []);
    this.fallbackChains.set('auth', []);
    this.fallbackChains.set('queue', []);
    this.fallbackChains.set('stateStore', []);
    this.fallbackChains.set('secrets', []);
    this.fallbackChains.set('repo', []);
    this.fallbackChains.set('deploy', []);
    this.fallbackChains.set('validation', []);
    this.fallbackChains.set('security', []);
    this.fallbackChains.set('observability', []);
    this.fallbackChains.set('notification', []);
  }

  /**
   * Update fallback chain for a capability
   */
  updateFallbackChain(capability: ProviderCapability, providerNames: string[]): void {
    this.fallbackChains.set(capability, providerNames);
    logger.info({ capability, providerNames }, 'Fallback chain updated');
  }
}

// Export singleton instance
export const providerRegistryService = new ProviderRegistryService();