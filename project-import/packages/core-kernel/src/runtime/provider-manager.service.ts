/**
 * ProviderManagerService — Provider Lifecycle Management
 * 
 * This service handles the complete lifecycle of providers including initialization,
 * configuration updates, graceful shutdown, and recovery mechanisms.
 */

import pino from 'pino';
import { Provider, ProviderCapability } from '../interfaces';
import { ProviderRegistryService } from './provider-registry.service';

const logger = pino({ name: 'provider-manager-service' });

export interface ProviderLifecycleEvent {
  provider: string;
  capability: ProviderCapability;
  eventType: 'initializing' | 'initialized' | 'stopping' | 'stopped' | 'error' | 'recovered';
  timestamp: Date;
  error?: Error;
}

export interface ProviderConfiguration {
  providerName: string;
  config: Record<string, any>;
  version?: string;
}

export class ProviderManagerService {
  private initializedProviders = new Set<string>();
  private providerConfigs = new Map<string, Record<string, any>>();
  private shutdownTimeout = 30000; // 30 seconds

  constructor(
    private registry: ProviderRegistryService
  ) {
    this.setupEventHandlers();
  }

  /**
   * Initialize a specific provider
   */
  async initializeProvider(providerName: string, config?: Record<string, any>): Promise<void> {
    logger.info({ provider: providerName }, 'Initializing provider');

    if (this.initializedProviders.has(providerName)) {
      logger.warn({ provider: providerName }, 'Provider already initialized');
      return;
    }

    try {
      const registration = this.registry.getAllProviders().find(r => r.metadata.name === providerName);
      if (!registration) {
        throw new Error(`Provider not found: ${providerName}`);
      }

      // Store configuration
      if (config) {
        this.providerConfigs.set(providerName, config);
      }

      // Initialize provider
      await registration.provider.initialize();
      this.initializedProviders.add(providerName);

      logger.info({ provider: providerName }, 'Provider initialized successfully');
    } catch (error) {
      logger.error({ provider: providerName, error }, 'Provider initialization failed');
      throw error;
    }
  }

  /**
   * Reconfigure a running provider
   */
  async reconfigureProvider(providerName: string, newConfig: Record<string, any>): Promise<void> {
    logger.info({ provider: providerName }, 'Reconfiguring provider');

    const registration = this.registry.getAllProviders().find(r => r.metadata.name === providerName);
    if (!registration) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    try {
      // Check if provider supports reconfiguration
      const providerImpl = registration.provider as any;
      if (providerImpl.reconfigure) {
        await providerImpl.reconfigure(newConfig);
      } else {
        // Fallback: stop and restart with new config
        await this.stopProvider(providerName);
        await this.initializeProvider(providerName, newConfig);
      }

      this.providerConfigs.set(providerName, newConfig);
      logger.info({ provider: providerName }, 'Provider reconfigured successfully');
    } catch (error) {
      logger.error({ provider: providerName, error }, 'Provider reconfiguration failed');
      throw error;
    }
  }

  /**
   * Stop a provider gracefully
   */
  async stopProvider(providerName: string): Promise<void> {
    logger.info({ provider: providerName }, 'Stopping provider');

    const registration = this.registry.getAllProviders().find(r => r.metadata.name === providerName);
    if (!registration) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    try {
      const providerImpl = registration.provider as any;
      if (providerImpl.shutdown) {
        await Promise.race([
          providerImpl.shutdown(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Shutdown timeout')), this.shutdownTimeout)
          )
        ]);
      }

      this.initializedProviders.delete(providerName);
      logger.info({ provider: providerName }, 'Provider stopped successfully');
    } catch (error) {
      logger.error({ provider: providerName, error }, 'Provider stop failed');
      throw error;
    }
  }

  /**
   * Restart a provider
   */
  async restartProvider(providerName: string): Promise<void> {
    logger.info({ provider: providerName }, 'Restarting provider');

    const config = this.providerConfigs.get(providerName);
    
    await this.stopProvider(providerName);
    await this.initializeProvider(providerName, config);
    
    logger.info({ provider: providerName }, 'Provider restarted successfully');
  }

  /**
   * Gracefully shutdown all providers
   */
  async shutdownAllProviders(): Promise<void> {
    logger.info('Shutting down all providers');

    const shutdownPromises = Array.from(this.initializedProviders).map(async (providerName) => {
      try {
        await this.stopProvider(providerName);
      } catch (error) {
        logger.error({ provider: providerName, error }, 'Provider shutdown failed');
      }
    });

    await Promise.allSettled(shutdownPromises);
    logger.info('All providers shut down');
  }

  /**
   * Recover a failed provider
   */
  async recoverProvider(providerName: string): Promise<void> {
    logger.info({ provider: providerName }, 'Recovering provider');

    try {
      const config = this.providerConfigs.get(providerName);
      await this.restartProvider(providerName);
      
      // Verify health after recovery
      const registration = this.registry.getAllProviders().find(r => r.metadata.name === providerName);
      if (registration) {
        const isHealthy = await registration.provider.healthCheck();
        if (!isHealthy) {
          throw new Error('Provider health check failed after recovery');
        }
      }
      
      logger.info({ provider: providerName }, 'Provider recovered successfully');
    } catch (error) {
      logger.error({ provider: providerName, error }, 'Provider recovery failed');
      throw error;
    }
  }

  /**
   * Get provider configuration
   */
  getProviderConfiguration(providerName: string): Record<string, any> | undefined {
    return this.providerConfigs.get(providerName);
  }

  /**
   * Get all initialized providers
   */
  getInitializedProviders(): string[] {
    return Array.from(this.initializedProviders);
  }

  /**
   * Check if provider is initialized
   */
  isProviderInitialized(providerName: string): boolean {
    return this.initializedProviders.has(providerName);
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.registry.on('provider:health-failed', async ({ provider, error }) => {
      logger.warn({ provider, error }, 'Provider health check failed, attempting recovery');
      
      try {
        await this.recoverProvider(provider);
      } catch (recoveryError) {
        logger.error({ provider, error: recoveryError }, 'Provider recovery failed');
      }
    });
  }

  /**
   * Set shutdown timeout
   */
  setShutdownTimeout(timeout: number): void {
    this.shutdownTimeout = timeout;
    logger.debug({ timeout }, 'Shutdown timeout updated');
  }
}