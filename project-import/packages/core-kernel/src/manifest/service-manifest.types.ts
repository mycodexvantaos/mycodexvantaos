/**
 * Service Manifest Type Definitions
 * 
 * Type definitions corresponding to the service-manifest-policy.yaml governance specification.
 * These types ensure type safety and provide compile-time validation for service manifests.
 */

/**
 * Supported API versions for service manifests
 */
export type ServiceManifestApiVersion = 'codexvanta.io/v1' | 'codexvanta.io/v1beta1';

/**
 * Service manifest kind
 */
export type ServiceManifestKind = 'ServiceManifest';

/**
 * Runtime mode for service execution
 */
export type RuntimeMode = 'native' | 'connected' | 'hybrid' | 'auto';

/**
 * Provider reference in service manifest
 */
export interface ProviderReference {
  name: string;
  capability: string;
  priority?: number;
  fallback?: string[];
  config?: Record<string, any>;
}

/**
 * Capability requirement specification
 */
export interface CapabilityRequirement {
  capability: string;
  required: boolean;
  providerReferences: ProviderReference[];
  runtimeModes: RuntimeMode[];
  fallbackEnabled: boolean;
}

/**
 * Service metadata
 */
export interface ServiceMetadata {
  name: string;
  description?: string;
  version: string;
  owner?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

/**
 * Resource requirements
 */
export interface ResourceRequirements {
  cpu?: string;
  memory?: string;
  storage?: string;
  ephemeralStorage?: string;
}

/**
 * Scaling configuration
 */
export interface ScalingConfig {
  minReplicas?: number;
  maxReplicas?: number;
  targetCPUUtilization?: number;
  targetMemoryUtilization?: number;
}

/**
 * Service specification
 */
export interface ServiceSpec {
  runtimeMode: RuntimeMode;
  capabilities: CapabilityRequirement[];
  resources?: ResourceRequirements;
  scaling?: ScalingConfig;
  environment?: Record<string, string>;
  config?: Record<string, any>;
}

/**
 * Service status
 */
export interface ServiceStatus {
  phase: 'pending' | 'running' | 'stopped' | 'error';
  message?: string;
  lastUpdated: string;
  providers?: {
    name: string;
    status: 'active' | 'inactive' | 'error';
    message?: string;
  }[];
}

/**
 * Complete service manifest
 */
export interface ServiceManifest {
  apiVersion: ServiceManifestApiVersion;
  kind: ServiceManifestKind;
  metadata: ServiceMetadata;
  spec: ServiceSpec;
  status?: ServiceStatus;
}

/**
 * Service manifest validation result
 */
export interface ServiceManifestValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  manifest?: ServiceManifest;
}

/**
 * Manifest load options
 */
export interface ManifestLoadOptions {
  validate?: boolean;
  resolveProviders?: boolean;
  checkRuntimeCompatibility?: boolean;
}

/**
 * Service manifest context
 */
export interface ServiceManifestContext {
  manifest: ServiceManifest;
  loadedFrom: string;
  loadedAt: Date;
  environment?: string;
}