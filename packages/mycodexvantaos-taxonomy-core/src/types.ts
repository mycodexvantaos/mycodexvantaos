/**
 * MyCodexVantaOS Taxonomy System Type Definitions
 * 
 * Following naming-spec-v1 canonical identifier specifications
 */

/**
 * Canonical capability IDs from mycodexvantaos naming-spec-v1 §5.5
 */
export type CanonicalCapabilityId = 
  | 'database' 
  | 'storage' 
  | 'auth' 
  | 'queue' 
  | 'state-store' 
  | 'secrets' 
  | 'repo' 
  | 'deploy' 
  | 'validation' 
  | 'security' 
  | 'observability' 
  | 'notification' 
  | 'scheduler' 
  | 'vector-store' 
  | 'embedding' 
  | 'llm' 
  | 'graph' 
  | 'cache' 
  | 'search';

/**
 * Service ID format: mycodexvantaos-<domain>-<capability>
 * Following naming-spec-v1 §5.1
 */
export type ServiceId = string;

/**
 * Package short ID format: <domain>-<capability>
 * Following naming-spec-v1 §5.2
 */
export type PackageShortId = string;

/**
 * Module ID equals Service ID
 * Following naming-spec-v1 §5.3
 */
export type ModuleId = ServiceId;

/**
 * Provider instance format: <capability-id>-<provider-name>
 * Following naming-spec-v1 §8.1
 */
export type ProviderInstanceId = string;

/**
 * Canonical identifier validation result
 */
export interface ValidationResult {
  valid: boolean;
  identifier: string;
  identifierType: 'service-id' | 'package-short-id' | 'module-id' | 'provider-instance' | 'capability-id';
  violations: ValidationViolation[];
}

/**
 * Validation violation detail
 */
export interface ValidationViolation {
  rule: string;
  message: string;
  suggestion?: string;
}

/**
 * Naming context for validation
 */
export interface NamingContext {
  allowVersion?: boolean; // §3.6: no version in canonical names (default: false)
  allowEnvironment?: boolean; // §3.7: no environment in canonical names (default: false)
  allowLegacyPrefix?: boolean; // §4: organization identity (default: false)
}

/**
 * Entity reference for taxonomy mapping
 */
export interface EntityReference {
  domain: string;
  capabilityOrName: string;
  type: 'service' | 'module' | 'package' | 'provider';
  modifier?: string;
}

/**
 * Taxonomy path representation
 */
export interface TaxonomyPath {
  organization: string; // always 'mycodexvantaos'
  domain: string;
  capability: string;
  canonical: string; // full canonical identifier
  package: string; // package name format
  k8sResource: string; // kubernetes resource name
}

/**
 * Lifecycle stage
 * Following naming-spec-v1 §11.1
 */
export type LifecycleStage = 
  | 'experimental' 
  | 'alpha' 
  | 'beta' 
  | 'stable' 
  | 'deprecated' 
  | 'archived';

/**
 * Service metadata
 */
export interface ServiceMetadata {
  serviceId: ServiceId;
  lifecycle?: LifecycleStage;
  version?: string; // §3.6: version in metadata, not in canonical name
  environment?: string; // §3.7: environment in metadata, not in canonical name
  description?: string;
  requiredProviders?: ProviderInstanceId[];
}