/**
 * Runtime Interface Definitions
 * 
 * Core interfaces for the provider runtime system including health status,
 * metadata, and lifecycle management contracts.
 */

/**
 * Provider health status enumeration
 */
export enum ProviderHealthStatus {
  UNKNOWN = 'unknown',
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
  STOPPED = 'stopped'
}

/**
 * Provider metadata information
 */
export interface ProviderMetadata {
  name: string;
  capability: string;
  version: string;
  priority: number;
  runtimeModes: ('native' | 'connected' | 'hybrid' | 'auto')[];
  registeredAt: Date;
  lastUpdated?: Date;
  description?: string;
  tags?: string[];
}

/**
 * Base provider interface
 */
export interface Provider {
  name: string;
  capability: string;
  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

/**
 * Provider runtime mode
 */
export type RuntimeMode = 'native' | 'connected' | 'hybrid' | 'auto';

/**
 * Provider capability contract
 */
export interface ProviderCapabilityContract {
  capability: string;
  interfaceVersion: string;
  requiredMethods: string[];
  optionalMethods: string[];
  compatibility: RuntimeMode[];
}

/**
 * Provider health check result
 */
export interface ProviderHealthCheckResult {
  provider: string;
  status: ProviderHealthStatus;
  timestamp: Date;
  message?: string;
  details?: Record<string, any>;
}

/**
 * Provider lifecycle state
 */
export enum ProviderLifecycleState {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Provider fallback configuration
 */
export interface ProviderFallbackConfig {
  capability: string;
  primary: string;
  fallbacks: {
    provider: string;
    condition: string;
    priority: number;
  }[];
}

/**
 * Provider discovery configuration
 */
export interface ProviderDiscoveryConfig {
  autoDiscovery: boolean;
  discoveryPaths: string[];
  capabilityMapping: Record<string, string[]>;
}

  /**
   * Provider Capability — string identifier for a provider's offered capability.
   * Used as map keys and registry indices throughout the runtime layer.
   * Examples: "database", "storage", "auth", "queue", "secrets", "observability".
   */
  export type ProviderCapability = string;
  