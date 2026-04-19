/**
 * Service Manifest Validator
 * 
 * Validates service manifests against the governance policy specification
 * defined in governance/service-manifest-policy.yaml. Provides comprehensive
 * validation including structural, semantic, and runtime compatibility checks.
 */

import pino from 'pino';
import {
  ServiceManifest,
  ServiceManifestValidationResult,
  RuntimeMode
} from './service-manifest.types';

const logger = pino({ name: 'service-manifest-validator' });

// Valid API versions
const VALID_API_VERSIONS = ['codexvanta.io/v1', 'codexvanta.io/v1beta1'];

// Valid runtime modes
const VALID_RUNTIME_MODES = ['native', 'connected', 'hybrid', 'auto'];

// Canonical provider capabilities
const CANONICAL_CAPABILITIES = [
  'database',
  'storage', 
  'auth',
  'queue',
  'stateStore',
  'secrets',
  'repo',
  'deploy',
  'validation',
  'security',
  'observability',
  'notification'
];

export class ServiceManifestValidator {
  /**
   * Validate service manifest against governance policy
   */
  async validate(manifest: ServiceManifest): Promise<ServiceManifestValidationResult> {
    const result: ServiceManifestValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      manifest
    };

    try {
      logger.info({ name: manifest.metadata?.name }, 'Validating service manifest');

      // Structural validation
      this.validateApiVersion(manifest, result);
      this.validateKind(manifest, result);
      this.validateMetadata(manifest, result);
      this.validateSpec(manifest, result);

      // Semantic validation
      this.validateCapabilities(manifest, result);
      this.validateProviderReferences(manifest, result);
      this.validateRuntimeModes(manifest, result);

      // Determine overall validity
      result.valid = result.errors.length === 0;

      if (result.valid) {
        logger.info({ name: manifest.metadata?.name }, 'Service manifest validation passed');
      } else {
        logger.warn({ 
          name: manifest.metadata?.name, 
          errors: result.errors.length 
        }, 'Service manifest validation failed');
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      logger.error({ error }, 'Service manifest validation encountered error');
    }

    return result;
  }

  /**
   * Validate API version
   */
  private validateApiVersion(manifest: ServiceManifest, result: ServiceManifestValidationResult): void {
    if (!manifest.apiVersion) {
      result.errors.push('apiVersion is required');
      return;
    }

    if (!VALID_API_VERSIONS.includes(manifest.apiVersion)) {
      result.errors.push(
        `Invalid apiVersion: ${manifest.apiVersion}. Valid values: ${VALID_API_VERSIONS.join(', ')}`
      );
    }
  }

  /**
   * Validate kind
   */
  private validateKind(manifest: ServiceManifest, result: ServiceManifestValidationResult): void {
    if (!manifest.kind) {
      result.errors.push('kind is required');
      return;
    }

    if (manifest.kind !== 'ServiceManifest') {
      result.errors.push(`Invalid kind: ${manifest.kind}. Must be "ServiceManifest"`);
    }
  }

  /**
   * Validate metadata
   */
  private validateMetadata(manifest: ServiceManifest, result: ServiceManifestValidationResult): void {
    if (!manifest.metadata) {
      result.errors.push('metadata is required');
      return;
    }

    // Validate name
    if (!manifest.metadata.name) {
      result.errors.push('metadata.name is required');
    } else {
      // Name should be lowercase alphanumeric with hyphens
      const nameRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
      if (!nameRegex.test(manifest.metadata.name)) {
        result.errors.push(
          'metadata.name must be lowercase alphanumeric with hyphens, ' +
          'starting and ending with alphanumeric characters'
        );
      }

      // Max length check
      if (manifest.metadata.name.length > 63) {
        result.errors.push('metadata.name must not exceed 63 characters');
      }
    }

    // Validate version
    if (!manifest.metadata.version) {
      result.errors.push('metadata.version is required');
    } else {
      // Semantic versioning format
      const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;
      if (!versionRegex.test(manifest.metadata.version)) {
        result.errors.push('metadata.version must follow semantic versioning (e.g., 1.0.0, 2.1.0-beta)');
      }
    }
  }

  /**
   * Validate spec
   */
  private validateSpec(manifest: ServiceManifest, result: ServiceManifestValidationResult): void {
    if (!manifest.spec) {
      result.errors.push('spec is required');
      return;
    }

    // Validate runtime mode
    if (!manifest.spec.runtimeMode) {
      result.errors.push('spec.runtimeMode is required');
    } else if (!VALID_RUNTIME_MODES.includes(manifest.spec.runtimeMode)) {
      result.errors.push(
        `Invalid spec.runtimeMode: ${manifest.spec.runtimeMode}. ` +
        `Valid values: ${VALID_RUNTIME_MODES.join(', ')}`
      );
    }

    // Validate capabilities
    if (!manifest.spec.capabilities || !Array.isArray(manifest.spec.capabilities)) {
      result.errors.push('spec.capabilities is required and must be an array');
    } else if (manifest.spec.capabilities.length === 0) {
      result.errors.push('spec.capabilities must contain at least one capability');
    }
  }

  /**
   * Validate capabilities
   */
  private validateCapabilities(manifest: ServiceManifest, result: ServiceManifestValidationResult): void {
    if (!manifest.spec?.capabilities) {
      return;
    }

    for (const cap of manifest.spec.capabilities) {
      // Validate capability name
      if (!cap.capability) {
        result.errors.push('Each capability must have a capability name');
        continue;
      }

      if (!CANONICAL_CAPABILITIES.includes(cap.capability)) {
        result.errors.push(
          `Invalid capability: ${cap.capability}. ` +
          `Must be one of: ${CANONICAL_CAPABILITIES.join(', ')}`
        );
      }

      // Validate required flag
      if (typeof cap.required !== 'boolean') {
        result.errors.push(`capability.${cap.capability}.required must be a boolean`);
      }

      // Validate provider references
      if (!cap.providerReferences || !Array.isArray(cap.providerReferences)) {
        result.errors.push(`capability.${cap.capability}.providerReferences is required and must be an array`);
      } else if (cap.providerReferences.length === 0) {
        result.errors.push(`capability.${cap.capability}.providerReferences must contain at least one provider`);
      }

      // Validate runtime modes
      if (!cap.runtimeModes || !Array.isArray(cap.runtimeModes)) {
        result.errors.push(`capability.${cap.capability}.runtimeModes is required and must be an array`);
      } else {
        for (const mode of cap.runtimeModes) {
          if (!VALID_RUNTIME_MODES.includes(mode)) {
            result.errors.push(
              `Invalid runtime mode ${mode} for capability ${cap.capability}. ` +
              `Valid values: ${VALID_RUNTIME_MODES.join(', ')}`
            );
          }
        }
      }

      // Validate fallback enabled flag
      if (typeof cap.fallbackEnabled !== 'boolean') {
        result.errors.push(`capability.${cap.capability}.fallbackEnabled must be a boolean`);
      }

      // Validate fallback configuration consistency
      if (cap.fallbackEnabled && cap.providerReferences.length === 1) {
        result.warnings.push(
          `capability.${cap.capability} has fallbackEnabled=true but only one provider reference. ` +
          'Fallback requires multiple providers.'
        );
      }
    }
  }

  /**
   * Validate provider references
   */
  private validateProviderReferences(manifest: ServiceManifest, result: ServiceManifestValidationResult): void {
    if (!manifest.spec?.capabilities) {
      return;
    }

    for (const cap of manifest.spec.capabilities) {
      if (!cap.providerReferences) {
        continue;
      }

      for (const ref of cap.providerReferences) {
        // Validate provider name
        if (!ref.name) {
          result.errors.push(`Provider reference for ${cap.capability} must have a name`);
        }

        // Validate capability match
        if (ref.capability !== cap.capability) {
          result.errors.push(
            `Provider ${ref.name} has capability ${ref.capability} but referenced in ${cap.capability} requirement`
          );
        }

        // Validate priority if provided
        if (ref.priority !== undefined && typeof ref.priority !== 'number') {
          result.errors.push(`Provider ${ref.name}.priority must be a number`);
        }

        if (ref.priority !== undefined && (ref.priority < 1 || ref.priority > 100)) {
          result.errors.push(`Provider ${ref.name}.priority must be between 1 and 100`);
        }

        // Validate fallback references
        if (ref.fallback && !Array.isArray(ref.fallback)) {
          result.errors.push(`Provider ${ref.name}.fallback must be an array`);
        }
      }
    }
  }

  /**
   * Validate runtime modes
   */
  private validateRuntimeModes(manifest: ServiceManifest, result: ServiceManifestValidationResult): void {
    const runtimeMode = manifest.spec?.runtimeMode;

    if (!runtimeMode || !manifest.spec?.capabilities) {
      return;
    }

    // Check that all capabilities support the service's runtime mode
    for (const cap of manifest.spec.capabilities) {
      if (cap.runtimeModes && !cap.runtimeModes.includes(runtimeMode as RuntimeMode)) {
        result.errors.push(
          `Capability ${cap.capability} does not support runtime mode ${runtimeMode}. ` +
          `Supported modes: ${cap.runtimeModes.join(', ')}`
        );
      }
    }

    // Auto mode validation warning
    if (runtimeMode === 'auto') {
      let hasFallbackProviders = false;
      for (const cap of manifest.spec.capabilities) {
        if (cap.fallbackEnabled && cap.providerReferences.length > 1) {
          hasFallbackProviders = true;
          break;
        }
      }

      if (!hasFallbackProviders) {
        result.warnings.push(
          'Service uses auto runtime mode but no capabilities have fallback providers configured. ' +
          'Auto mode works best with fallback providers for resilience.'
        );
      }
    }

    // Hybrid mode validation warning
    if (runtimeMode === 'hybrid') {
      let hasNativeProviders = false;
      let hasConnectedProviders = false;

      for (const cap of manifest.spec.capabilities) {
        if (cap.runtimeModes) {
          if (cap.runtimeModes.includes('native')) {
            hasNativeProviders = true;
          }
          if (cap.runtimeModes.includes('connected')) {
            hasConnectedProviders = true;
          }
        }
      }

      if (!hasNativeProviders || !hasConnectedProviders) {
        result.warnings.push(
          'Service uses hybrid runtime mode but capabilities do not support both native and connected modes. ' +
          'Hybrid mode requires capabilities that support both native and connected execution.'
        );
      }
    }
  }

  /**
   * Validate manifest for specific runtime environment
   */
  async validateForRuntime(
    manifest: ServiceManifest,
    runtimeEnvironment: 'native' | 'connected' | 'hybrid' | 'auto'
  ): Promise<ServiceManifestValidationResult> {
    const result = await this.validate(manifest);

    // Additional runtime-specific validation
    if (manifest.spec?.runtimeMode !== runtimeEnvironment && runtimeEnvironment !== 'auto') {
      result.warnings.push(
        `Service runtime mode is ${manifest.spec.runtimeMode} but runtime environment is ${runtimeEnvironment}`
      );
    }

    return result;
  }
}