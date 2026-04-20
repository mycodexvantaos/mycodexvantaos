/**
 * MyCodexVantaOS Namespaces SDK
 * 
 * Main SDK orchestration and lifecycle management
 */

import { BaseProvider, SDKConfig, ResolvedMode } from './types';
import { ProviderRegistry } from './registry';

/**
 * MyCodexVantaOS Namespaces SDK
 * 
 * Main entry point for provider orchestration
 */
export class MyCodexVantaOSSDK {
  private static instance: MyCodexVantaOSSDK;
  private config: SDKConfig;
  private registry: ProviderRegistry;
  private mode: ResolvedMode;
  private initialized: boolean = false;

  private constructor(config: SDKConfig = {}) {
    this.config = config;
    this.registry = ProviderRegistry.getInstance();
    this.mode = config.mode || 'native';
  }

  /**
   * Create or get SDK instance
   */
  static async create(config?: SDKConfig): Promise<MyCodexVantaOSSDK> {
    if (!MyCodexVantaOSSDK.instance) {
      const sdk = new MyCodexVantaOSSDK(config);
      await sdk.initialize();
      MyCodexVantaOSSDK.instance = sdk;
    }
    return MyCodexVantaOSSDK.instance;
  }

  /**
   * Get existing instance
   */
  static getInstance(): MyCodexVantaOSSDK | undefined {
    return MyCodexVantaOSSDK.instance;
  }

  /**
   * Initialize the SDK
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Auto-detect mode if not specified
    if (!this.config.mode) {
      this.mode = await this.detectMode();
    }

    // Initialize all registered providers
    await this.registry.initializeAll();

    this.initialized = true;
    
    if (this.config.debug) {
      console.log(`[MyCodexVantaOSSDK] Initialized in ${this.mode} mode`);
      console.log('[MyCodexVantaOSSDK] Registry stats:', this.registry.getStats());
    }
  }

  /**
   * Auto-detect runtime mode
   */
  private async detectMode(): Promise<ResolvedMode> {
    // Check for external cloud environment
    if (process.env.CLOUD_PROVIDER || process.env.AWS_REGION || process.env.GOOGLE_CLOUD_PROJECT) {
      return 'connected';
    }

    // Check for hybrid indicators
    const hasNativeProviders = this.registry.list().length > 0;
    const hasExternalConnections = process.env.EXTERNAL_API_URLS?.length > 0;

    if (hasNativeProviders && hasExternalConnections) {
      return 'hybrid';
    }

    // Default to native
    return 'native';
  }

  /**
   * Register a provider
   */
  register(provider: BaseProvider, providerName: string): void {
    this.registry.register(provider, providerName);
  }

  /**
   * Get a provider
   */
  getProvider(providerName: string): BaseProvider | undefined {
    return this.registry.get(providerName);
  }

  /**
   * Get provider by capability
   */
  getProviderByCapability(capability: string): BaseProvider | undefined {
    return this.registry.getByCapabilityFirst(capability as any);
  }

  /**
   * Get registry instance
   */
  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  /**
   * Perform health check on all providers
   */
  async healthCheck(): Promise<Map<string, {
    status: string;
    timestamp: Date;
    message?: string;
  }>> {
    const results = await this.registry.healthCheckAll();
    return results as any;
  }

  /**
   * Get current mode
   */
  getMode(): ResolvedMode {
    return this.mode;
  }

  /**
   * Shutdown the SDK
   */
  async shutdown(): Promise<void> {
    await this.registry.shutdownAll();
    this.initialized = false;
    
    if (this.config.debug) {
      console.log('[MyCodexVantaOSSDK] Shutdown complete');
    }
  }

  /**
   * Get SDK configuration
   */
  getConfig(): SDKConfig {
    return { ...this.config };
  }

  /**
   * Check if SDK is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Factory function to create SDK instance
 */
export async function createSDK(config?: SDKConfig): Promise<MyCodexVantaOSSDK> {
  return MyCodexVantaOSSDK.create(config);
}