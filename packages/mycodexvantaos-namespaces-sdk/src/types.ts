/**
 * MyCodexVantaOS Namespaces SDK Type Definitions
 * 
 * Provider abstraction layer and capability interfaces
 * Following MyCodexVantaOS naming-spec-v1 and unified-architecture-spec
 */

import { CanonicalCapabilityId } from '@mycodexvantaos/taxonomy-core';

/**
 * Provider source type
 * Whether the provider is native (built-in) or external (third-party)
 */
export type ProviderSource = 'native' | 'external';

/**
 * Provider criticality level
 */
export type ProviderCriticality = 'critical' | 'high' | 'medium' | 'low';

/**
 * Resolved runtime mode
 * Auto-determined based on provider availability and configuration
 */
export type ResolvedMode = 'native' | 'connected' | 'hybrid';

/**
 * Provider capability from canonical set
 * §5.5 of naming-spec-v1
 */
export type ProviderCapability = CanonicalCapabilityId;

/**
 * Health check status
 */
export type HealthStatus = 
  | 'healthy' 
  | 'degraded' 
  | 'unhealthy' 
  | 'unknown';

/**
 * Detailed health check result
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  message?: string;
  details?: Record<string, unknown>;
  latency?: number;
}

/**
 * Provider initialization configuration
 */
export interface ProviderConfig {
  capability: ProviderCapability;
  providerName: string;
  mode?: ResolvedMode;
  config?: Record<string, unknown>;
  credentials?: Record<string, string>;
  timeout?: number;
}

/**
 * Base provider interface
 * All providers must implement this contract
 */
export interface BaseProvider {
  readonly capability: ProviderCapability;
  readonly source: ProviderSource;
  readonly criticality: ProviderCriticality;
  readonly supportsModes: ResolvedMode[];
  
  /**
   * Initialize the provider with configuration
   */
  initialize?(config?: unknown): Promise<void>;
  
  /**
   * Perform health check
   */
  healthCheck(): Promise<HealthCheckResult>;
  
  /**
   * Shutdown and cleanup
   */
  shutdown?(): Promise<void>;
}

/**
 * Database provider interface
 */
export interface DatabaseProvider extends BaseProvider {
  readonly capability: 'database';
  
  query(sql: string, params?: unknown[]): Promise<unknown[]>;
  execute(sql: string, params?: unknown[]): Promise<{ affectedRows: number }>;
  transaction<T>(callback: (client: unknown) => Promise<T>): Promise<T>;
}

/**
 * Storage provider interface
 */
export interface StorageProvider extends BaseProvider {
  readonly capability: 'storage';
  
  put(key: string, data: Buffer | string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  list(prefix?: string): Promise<string[]>;
}

/**
 * Auth provider interface
 */
export interface AuthProvider extends BaseProvider {
  readonly capability: 'auth';
  
  authenticate(token: string): Promise<{ userId: string; roles: string[] }>;
  authorize(userId: string, resource: string, action: string): Promise<boolean>;
  generateToken(userId: string, roles: string[]): Promise<string>;
  validateToken(token: string): Promise<boolean>;
}

/**
 * Secrets provider interface
 */
export interface SecretsProvider extends BaseProvider {
  readonly capability: 'secrets';
  
  getSecret(key: string): Promise<string>;
  setSecret(key: string, value: string): Promise<void>;
  deleteSecret(key: string): Promise<void>;
  listSecrets(): Promise<string[]>;
}

/**
 * Observability provider interface
 */
export interface ObservabilityProvider extends BaseProvider {
  readonly capability: 'observability';
  
  log(level: 'info' | 'warn' | 'error', message: string, metadata?: Record<string, unknown>): Promise<void>;
  metric(name: string, value: number, labels?: Record<string, string>): Promise<void>;
  trace(spanName: string, fn: () => Promise<unknown>): Promise<unknown>;
}

/**
 * Vector store provider interface
 */
export interface VectorStoreProvider extends BaseProvider {
  readonly capability: 'vector-store';
  
  upsert(collection: string, vectors: Array<{ id: string; values: number[]; metadata?: Record<string, unknown> }>): Promise<void>;
  query(collection: string, vector: number[], topK: number, filter?: Record<string, unknown>): Promise<Array<{ id: string; score: number; metadata?: Record<string, unknown> }>>;
  delete(collection: string, ids: string[]): Promise<void>;
  createCollection(collection: string, dimension: number): Promise<void>;
  dropCollection(collection: string): Promise<void>;
}

/**
 * LLM provider interface
 */
export interface LLMProvider extends BaseProvider {
  readonly capability: 'llm';
  
  chat(messages: Array<{ role: string; content: string }>): Promise<{ content: string; usage?: { promptTokens: number; completionTokens: number } }>;
  streamChat(messages: Array<{ role: string; content: string }>, onChunk: (chunk: string) => void): Promise<void>;
  embedding(text: string): Promise<number[]>;
}

/**
 * Provider registry entry
 */
export interface ProviderRegistryEntry {
  providerName: string;
  capability: ProviderCapability;
  source: ProviderSource;
  criticality: ProviderCriticality;
  supportsModes: ResolvedMode[];
  instance: BaseProvider;
  initialized: boolean;
  health: HealthStatus;
}

/**
 * SDK configuration
 */
export interface SDKConfig {
  debug?: boolean;
  environment?: 'development' | 'staging' | 'production';
  requiredProviders?: Array<{ capability: ProviderCapability; providerName?: string }>;
  optionalProviders?: Array<{ capability: ProviderCapability; providerName?: string }>;
  mode?: ResolvedMode;
  credentialProviders?: string[];
}