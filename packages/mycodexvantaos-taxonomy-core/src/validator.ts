/**
 * MyCodexVantaOS Taxonomy Validator
 * 
 * Validates canonical identifiers against naming-spec-v1
 */

import { 
  ValidationResult, 
  ValidationViolation, 
  NamingContext, 
  ServiceId, 
  PackageShortId, 
  ModuleId, 
  ProviderInstanceId 
} from './types';

/**
 * Regular expressions from naming-spec-v1
 */
const PATTERNS = {
  // §5.1: service id: mycodexvantaos-<domain>-<capability>
  serviceId: /^mycodexvantaos-[a-z0-9]+(?:-[a-z0-9]+)+$/,
  
  // §5.2: package short id: <domain>-<capability>
  packageShortId: /^[a-z0-9]+(?:-[a-z0-9]+)+$/,
  
  // §5.5: canonical capability id
  capabilityId: /^(database|storage|auth|queue|state-store|secrets|repo|deploy|validation|security|observability|notification|scheduler|vector-store|embedding|llm|graph|cache|search)$/,
  
  // §8.1: provider instance: <capability-id>-<provider-name>
  providerInstance: /^(database|storage|auth|queue|state-store|secrets|repo|deploy|validation|security|observability|notification|scheduler|vector-store|embedding|llm|graph|cache|search)-[a-z0-9-]+$/,
  
  // §3.1: allowed characters (baseline)
  allowedChars: /^[a-z0-9-]+$/,
  
  // §3.3: no consecutive hyphens
  noConsecutiveHyphens: /^(?!.*--).*$/,
  
  // §3.2: lowercase only
  lowercase: /^[a-z0-9-]*$/,
  
  // §3.6: no version in canonical names
  noVersion: /^(?!.*(v\d+|version|ver|release|rel)).*$/,
  
  // §3.7: no environment in canonical names
  noEnvironment: /^(?!.*(dev|staging|prod|production|test|uat|sandbox)).*$/i,
  
  // §4: organization identity - forbid legacy prefixes
  noLegacyPrefix: /^(?!.*(mycodexvanta-os|codexvanta|codexvanta-os)).*$/,
};

/**
 * MyCodexVantaOS Taxonomy Validator
 * 
 * Validates canonical identifiers against naming-spec-v1 specifications
 */
export class MyCodexVantaOSValidator {
  /**
   * Validate a service ID
   * §5.1: mycodexvantaos-<domain>-<capability>
   */
  static validateServiceId(id: string): ValidationResult {
    const violations: ValidationViolation[] = [];
    
    // Check allowed characters
    if (!PATTERNS.allowedChars.test(id)) {
      violations.push({
        rule: 'allowed-characters',
        message: 'Service ID must contain only lowercase letters, numbers, and hyphens (a-z0-9-)',
        suggestion: 'Remove underscores, spaces, dots, colons, or @ symbols'
      });
    }
    
    // Check lowercase
    if (!PATTERNS.lowercase.test(id)) {
      violations.push({
        rule: 'lowercase-only',
        message: 'Service ID must be lowercase only',
        suggestion: 'Convert all uppercase letters to lowercase'
      });
    }
    
    // Check consecutive hyphens
    if (!PATTERNS.noConsecutiveHyphens.test(id)) {
      violations.push({
        rule: 'no-consecutive-hyphens',
        message: 'Service ID must not contain consecutive hyphens',
        suggestion: 'Replace -- with single -'
      });
    }
    
    // Check service ID pattern
    if (!PATTERNS.serviceId.test(id)) {
      violations.push({
        rule: 'service-id-format',
        message: 'Service ID must follow format: mycodexvantaos-<domain>-<capability>',
        suggestion: 'Ensure ID starts with mycodexvantaos- and has at least one domain and one capability segment'
      });
    }
    
    // Check no version
    if (!PATTERNS.noVersion.test(id)) {
      violations.push({
        rule: 'no-version-in-canonical',
        message: 'Version information must not appear in service ID (naming-spec-v1 §3.6)',
        suggestion: 'Move version information to metadata, tags, or labels'
      });
    }
    
    // Check no environment
    if (!PATTERNS.noEnvironment.test(id)) {
      violations.push({
        rule: 'no-environment-in-canonical',
        message: 'Environment information must not appear in service ID (naming-spec-v1 §3.7)',
        suggestion: 'Move environment information to namespace, labels, or deployment metadata'
      });
    }
    
    return {
      valid: violations.length === 0,
      identifier: id,
      identifierType: 'service-id',
      violations
    };
  }

  /**
   * Validate a package short ID
   * §5.2: <domain>-<capability>
   */
  static validatePackageShortId(id: string): ValidationResult {
    const violations: ValidationViolation[] = [];
    
    // Check allowed characters
    if (!PATTERNS.allowedChars.test(id)) {
      violations.push({
        rule: 'allowed-characters',
        message: 'Package short ID must contain only lowercase letters, numbers, and hyphens (a-z0-9-)',
        suggestion: 'Remove underscores, spaces, dots, colons, or @ symbols'
      });
    }
    
    // Check lowercase
    if (!PATTERNS.lowercase.test(id)) {
      violations.push({
        rule: 'lowercase-only',
        message: 'Package short ID must be lowercase only',
        suggestion: 'Convert all uppercase letters to lowercase'
      });
    }
    
    // Check consecutive hyphens
    if (!PATTERNS.noConsecutiveHyphens.test(id)) {
      violations.push({
        rule: 'no-consecutive-hyphens',
        message: 'Package short ID must not contain consecutive hyphens',
        suggestion: 'Replace -- with single -'
      });
    }
    
    // Check package short ID pattern
    if (!PATTERNS.packageShortId.test(id)) {
      violations.push({
        rule: 'package-short-id-format',
        message: 'Package short ID must follow format: <domain>-<capability>',
        suggestion: 'Ensure ID has at least one domain and one capability segment separated by hyphens'
      });
    }
    
    // Check no version
    if (!PATTERNS.noVersion.test(id)) {
      violations.push({
        rule: 'no-version-in-canonical',
        message: 'Version information must not appear in package short ID (naming-spec-v1 §3.6)',
        suggestion: 'Move version information to metadata, tags, or labels'
      });
    }
    
    // Check no environment
    if (!PATTERNS.noEnvironment.test(id)) {
      violations.push({
        rule: 'no-environment-in-canonical',
        message: 'Environment information must not appear in package short ID (naming-spec-v1 §3.7)',
        suggestion: 'Move environment information to namespace, labels, or deployment metadata'
      });
    }
    
    return {
      valid: violations.length === 0,
      identifier: id,
      identifierType: 'package-short-id',
      violations
    };
  }

  /**
   * Validate a module ID
   * §5.3: module id equals service id
   */
  static validateModuleId(id: string): ValidationResult {
    // Module ID has same validation as Service ID
    const result = this.validateServiceId(id);
    result.identifierType = 'module-id';
    return result;
  }

  /**
   * Validate a capability ID
   * §5.5: canonical capability IDs
   */
  static validateCapabilityId(id: string): ValidationResult {
    const violations: ValidationViolation[] = [];
    
    // Check capability ID pattern against canonical set
    if (!PATTERNS.capabilityId.test(id)) {
      violations.push({
        rule: 'canonical-capability-id',
        message: 'Capability ID must be from the canonical capability set defined in naming-spec-v1 §5.5',
        suggestion: 'Use one of: database, storage, auth, queue, state-store, secrets, repo, deploy, validation, security, observability, notification, scheduler, vector-store, embedding, llm, graph, cache, search'
      });
    }
    
    return {
      valid: violations.length === 0,
      identifier: id,
      identifierType: 'capability-id',
      violations
    };
  }

  /**
   * Validate a provider instance ID
   * §8.1: <capability-id>-<provider-name>
   */
  static validateProviderInstanceId(id: string): ValidationResult {
    const violations: ValidationViolation[] = [];
    
    // Check allowed characters
    if (!PATTERNS.allowedChars.test(id)) {
      violations.push({
        rule: 'allowed-characters',
        message: 'Provider instance ID must contain only lowercase letters, numbers, and hyphens (a-z0-9-)',
        suggestion: 'Remove underscores, spaces, dots, colons, or @ symbols'
      });
    }
    
    // Check lowercase
    if (!PATTERNS.lowercase.test(id)) {
      violations.push({
        rule: 'lowercase-only',
        message: 'Provider instance ID must be lowercase only',
        suggestion: 'Convert all uppercase letters to lowercase'
      });
    }
    
    // Check consecutive hyphens
    if (!PATTERNS.noConsecutiveHyphens.test(id)) {
      violations.push({
        rule: 'no-consecutive-hyphens',
        message: 'Provider instance ID must not contain consecutive hyphens',
        suggestion: 'Replace -- with single -'
      });
    }
    
    // Check provider instance pattern
    if (!PATTERNS.providerInstance.test(id)) {
      violations.push({
        rule: 'provider-instance-format',
        message: 'Provider instance ID must follow format: <capability-id>-<provider-name>',
        suggestion: 'Ensure ID starts with a canonical capability ID followed by hyphen and provider name'
      });
    }
    
    // Check no version
    if (!PATTERNS.noVersion.test(id)) {
      violations.push({
        rule: 'no-version-in-canonical',
        message: 'Version information must not appear in provider instance ID (naming-spec-v1 §3.6)',
        suggestion: 'Move version information to metadata, tags, or labels'
      });
    }
    
    // Check no environment
    if (!PATTERNS.noEnvironment.test(id)) {
      violations.push({
        rule: 'no-environment-in-canonical',
        message: 'Environment information must not appear in provider instance ID (naming-spec-v1 §3.7)',
        suggestion: 'Move environment information to namespace, labels, or deployment metadata'
      });
    }
    
    // Extract capability part and validate it's canonical
    const match = id.match(/^([a-z-]+)-(.+)$/);
    if (match) {
      const capabilityPart = match[1];
      const capabilityValidation = this.validateCapabilityId(capabilityPart);
      if (!capabilityValidation.valid) {
        violations.push({
          rule: 'canonical-capability-in-provider',
          message: 'Provider instance must start with a canonical capability ID',
          suggestion: capabilityValidation.violations[0]?.suggestion
        });
      }
    }
    
    return {
      valid: violations.length === 0,
      identifier: id,
      identifierType: 'provider-instance',
      violations
    };
  }

  /**
   * Validate any canonical identifier with context
   */
  static validate(identifier: string, type: 'service-id' | 'package-short-id' | 'module-id' | 'provider-instance' | 'capability-id', context?: NamingContext): ValidationResult {
    switch (type) {
      case 'service-id':
        return this.validateServiceId(identifier);
      case 'package-short-id':
        return this.validatePackageShortId(identifier);
      case 'module-id':
        return this.validateModuleId(identifier);
      case 'provider-instance':
        return this.validateProviderInstanceId(identifier);
      case 'capability-id':
        return this.validateCapabilityId(identifier);
      default:
        return {
          valid: false,
          identifier,
          identifierType: 'service-id',
          violations: [{
            rule: 'unknown-identifier-type',
            message: 'Unknown identifier type specified',
            suggestion: 'Use one of: service-id, package-short-id, module-id, provider-instance, capability-id'
          }]
        };
    }
  }

  /**
   * Validate multiple identifiers
   */
  static validateMany(identifiers: Array<{ id: string; type: 'service-id' | 'package-short-id' | 'module-id' | 'provider-instance' | 'capability-id' }>): ValidationResult[] {
    return identifiers.map(({ id, type }) => this.validate(id, type));
  }

  /**
   * Check compliance across multiple identifiers
   */
  static checkCompliance(identifiers: Array<{ id: string; type: 'service-id' | 'package-short-id' | 'module-id' | 'provider-instance' | 'capability-id' }>): {
    compliant: boolean;
    score: number;
    violations: ValidationViolation[];
    total: number;
    valid: number;
    invalid: number;
  } {
    const results = this.validateMany(identifiers);
    const violations = results.flatMap(r => r.violations);
    const valid = results.filter(r => r.valid).length;
    const total = results.length;
    
    return {
      compliant: valid === total,
      score: total === 0 ? 100 : Math.round((valid / total) * 100),
      violations,
      total,
      valid,
      invalid: total - valid
    };
  }
}

/**
 * Export validation patterns for external use
 */
export const ValidationPatterns = PATTERNS;