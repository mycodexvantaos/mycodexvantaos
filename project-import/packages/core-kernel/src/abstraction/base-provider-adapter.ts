/**
 * Base Provider Adapter
 * 
 * Abstract base class for provider adapters that provides common functionality
 * and enforces the adapter contract. Concrete adapters should extend this base
 * class and implement the abstract methods.
 */

import pino from 'pino';
import { 
  ProviderAdapter, 
  ProviderContext, 
  AdapterHealthStatus 
} from './provider-adapter.interface';
import { ProviderHealthStatus } from '../interfaces/runtime';

const logger = pino({ name: 'base-provider-adapter' });

export abstract class BaseProviderAdapter<TImplementation = any> implements ProviderAdapter<TImplementation> {
  protected implementation: TImplementation | null = null;
  protected config: Record<string, any> = {};
  protected initialized: boolean = false;
  protected healthStatus: ProviderHealthStatus = ProviderHealthStatus.UNKNOWN;
  protected lastHealthCheck: Date | null = null;

  constructor(
    public readonly name: string,
    public readonly capability: string,
    public readonly runtimeModes: ('native' | 'connected' | 'hybrid' | 'auto')[]
  ) {
    this.validateConstructor();
  }

  /**
   * Initialize the adapter
   */
  async initialize(config?: Record<string, any>): Promise<void> {
    logger.info({ adapter: this.name, capability: this.capability }, 'Initializing provider adapter');

    if (this.initialized) {
      logger.warn({ adapter: this.name }, 'Adapter already initialized');
      return;
    }

    try {
      // Store configuration
      this.config = config || {};

      // Validate configuration
      await this.validateConfig(this.config);

      // Create implementation
      this.implementation = await this.createImplementation(this.config);

      // Initialize implementation
      await this.initializeImplementation(this.implementation);

      this.initialized = true;
      this.healthStatus = ProviderHealthStatus.HEALTHY;
      this.lastHealthCheck = new Date();

      logger.info({ adapter: this.name }, 'Provider adapter initialized successfully');
    } catch (error) {
      this.healthStatus = ProviderHealthStatus.UNHEALTHY;
      this.lastHealthCheck = new Date();
      
      logger.error({ adapter: this.name, error }, 'Provider adapter initialization failed');
      throw new Error(`Adapter initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the underlying implementation
   */
  getImplementation(): TImplementation {
    if (!this.initialized || !this.implementation) {
      throw new Error(`Adapter ${this.name} is not initialized`);
    }
    return this.implementation;
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      logger.debug({ adapter: this.name }, 'Performing health check');

      if (!this.initialized) {
        this.healthStatus = ProviderHealthStatus.STOPPED;
        this.lastHealthCheck = new Date();
        return false;
      }

      // Perform implementation-specific health check
      const isHealthy = await this.performHealthCheck(this.implementation!);
      
      this.healthStatus = isHealthy ? ProviderHealthStatus.HEALTHY : ProviderHealthStatus.UNHEALTHY;
      this.lastHealthCheck = new Date();

      logger.debug({ 
        adapter: this.name, 
        status: this.healthStatus 
      }, 'Health check completed');

      return isHealthy;
    } catch (error) {
      this.healthStatus = ProviderHealthStatus.UNHEALTHY;
      this.lastHealthCheck = new Date();
      
      logger.error({ adapter: this.name, error }, 'Health check failed');
      return false;
    }
  }

  /**
   * Shutdown the adapter
   */
  async shutdown(): Promise<void> {
    logger.info({ adapter: this.name }, 'Shutting down provider adapter');

    try {
      if (this.implementation) {
        await this.shutdownImplementation(this.implementation);
      }

      this.implementation = null;
      this.initialized = false;
      this.healthStatus = ProviderHealthStatus.STOPPED;
      this.lastHealthCheck = new Date();

      logger.info({ adapter: this.name }, 'Provider adapter shut down successfully');
    } catch (error) {
      logger.error({ adapter: this.name, error }, 'Provider adapter shutdown failed');
      throw error;
    }
  }

  /**
   * Reconfigure the adapter
   */
  async reconfigure(newConfig: Record<string, any>): Promise<void> {
    logger.info({ adapter: this.name }, 'Reconfiguring provider adapter');

    if (!this.implementation) {
      throw new Error(`Adapter ${this.name} is not initialized`);
    }

    try {
      // Validate new configuration
      await this.validateConfig(newConfig);

      // Perform reconfiguration
      await this.reconfigureImplementation(this.implementation, newConfig);

      this.config = newConfig;
      this.healthStatus = ProviderHealthStatus.HEALTHY;
      this.lastHealthCheck = new Date();

      logger.info({ adapter: this.name }, 'Provider adapter reconfigured successfully');
    } catch (error) {
      this.healthStatus = ProviderHealthStatus.UNHEALTHY;
      this.lastHealthCheck = new Date();
      
      logger.error({ adapter: this.name, error }, 'Provider adapter reconfiguration failed');
      throw error;
    }
  }

  /**
   * Get adapter health status
   */
  getHealthStatus(): AdapterHealthStatus {
    return {
      adapterName: this.name,
      status: this.healthStatus,
      timestamp: this.lastHealthCheck || new Date(),
      message: this.getStatusMessage()
    };
  }

  /**
   * Check if adapter is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Check if adapter is healthy
   */
  isHealthy(): boolean {
    return this.initialized && this.healthStatus === ProviderHealthStatus.HEALTHY;
  }

  /**
   * Get adapter configuration
   */
  getConfig(): Record<string, any> {
    return { ...this.config };
  }

  // Abstract methods that must be implemented by concrete adapters

  /**
   * Create the provider implementation
   */
  protected abstract createImplementation(config: Record<string, any>): Promise<TImplementation>;

  /**
   * Initialize the implementation
   */
  protected abstract initializeImplementation(implementation: TImplementation): Promise<void>;

  /**
   * Perform health check on implementation
   */
  protected abstract performHealthCheck(implementation: TImplementation): Promise<boolean>;

  /**
   * Shutdown the implementation
   */
  protected abstract shutdownImplementation(implementation: TImplementation): Promise<void>;

  /**
   * Reconfigure the implementation (optional)
   */
  protected async reconfigureImplementation(
    implementation: TImplementation,
    newConfig: Record<string, any>
  ): Promise<void> {
    throw new Error('Reconfiguration not supported by this adapter');
  }

  /**
   * Validate configuration
   */
  protected async validateConfig(config: Record<string, any>): Promise<void> {
    // Base validation - can be overridden by implementations
    if (!config || typeof config !== 'object') {
      throw new Error('Configuration must be an object');
    }
  }

  /**
   * Get status message
   */
  protected getStatusMessage(): string {
    switch (this.healthStatus) {
      case ProviderHealthStatus.HEALTHY:
        return 'Adapter is healthy and operational';
      case ProviderHealthStatus.UNHEALTHY:
        return 'Adapter is unhealthy and may not function correctly';
      case ProviderHealthStatus.DEGRADED:
        return 'Adapter is operating with reduced functionality';
      case ProviderHealthStatus.STOPPED:
        return 'Adapter is stopped';
      case ProviderHealthStatus.UNKNOWN:
        return 'Adapter health status is unknown';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Validate constructor parameters
   */
  private validateConstructor(): void {
    if (!this.name) {
      throw new Error('Adapter name is required');
    }

    if (!this.capability) {
      throw new Error('Adapter capability is required');
    }

    if (!this.runtimeModes || this.runtimeModes.length === 0) {
      throw new Error('Adapter must support at least one runtime mode');
    }

    const validModes = ['native', 'connected', 'hybrid', 'auto'];
    for (const mode of this.runtimeModes) {
      if (!validModes.includes(mode)) {
        throw new Error(`Invalid runtime mode: ${mode}`);
      }
    }
  }
}