/**
 * Provider Adapter Interface
 * 
 * Defines the contract for provider adapters that bridge concrete provider
 * implementations with the standardized provider abstraction layer. This enables
 * cloud-agnostic provider selection and runtime mode switching.
 */

import { Provider, ProviderHealthStatus } from '../interfaces/runtime';

/**
 * Provider adapter interface
 */
export interface ProviderAdapter<TProviderImplementation = any> {
  /**
   * Adapter name
   */
  readonly name: string;

  /**
   * Capability this adapter provides
   */
  readonly capability: string;

  /**
   * Supported runtime modes
   */
  readonly runtimeModes: ('native' | 'connected' | 'hybrid' | 'auto')[];

  /**
   * Initialize the adapter
   */
  initialize(config?: Record<string, any>): Promise<void>;

  /**
   * Get the underlying provider implementation
   */
  getImplementation(): TProviderImplementation;

  /**
   * Perform health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Shutdown the adapter
   */
  shutdown(): Promise<void>;

  /**
   * Reconfigure the adapter
   */
  reconfigure?(newConfig: Record<string, any>): Promise<void>;
}

/**
 * Provider adapter factory interface
 */
export interface ProviderAdapterFactory {
  /**
   * Create a provider adapter
   */
  createAdapter(config: Record<string, any>): ProviderAdapter;

  /**
   * Validate configuration
   */
  validateConfig(config: Record<string, any>): boolean;

  /**
   * Get adapter metadata
   */
  getMetadata(): ProviderAdapterMetadata;
}

/**
 * Provider adapter metadata
 */
export interface ProviderAdapterMetadata {
  name: string;
  capability: string;
  version: string;
  description?: string;
  author?: string;
  supportedRuntimeModes: ('native' | 'connected' | 'hybrid' | 'auto')[];
  configSchema?: Record<string, any>;
  dependencies?: string[];
}

/**
 * Provider context for adapter operations
 */
export interface ProviderContext {
  runtimeMode: 'native' | 'connected' | 'hybrid' | 'auto';
  environment: 'development' | 'staging' | 'production';
  serviceName?: string;
  tenantId?: string;
  region?: string;
  additionalContext?: Record<string, any>;
}

/**
 * Adapter health status
 */
export interface AdapterHealthStatus {
  adapterName: string;
  status: ProviderHealthStatus;
  timestamp: Date;
  message?: string;
  details?: Record<string, any>;
}

/**
 * Adapter configuration
 */
export interface AdapterConfiguration {
  name: string;
  capability: string;
  implementation: string;
  config: Record<string, any>;
  priority: number;
  runtimeModes: ('native' | 'connected' | 'hybrid' | 'auto')[];
  fallback?: string[];
}