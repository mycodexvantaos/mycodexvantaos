/**
 * Governance Enforcement Engine
 * 
 * Runtime policy enforcement engine that validates and enforces governance policies
 * across service manifests, provider configurations, and runtime operations.
 * Integrates with governance policies defined in the governance/ directory.
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ServiceManifest,
  ServiceManifestValidationResult
} from '../manifest/service-manifest.types';
import { ServiceManifestValidator } from '../manifest/service-manifest.validator';

const logger = pino({ name: 'governance-enforcer' });

export interface GovernancePolicy {
  name: string;
  version: string;
  description?: string;
  rules: GovernanceRule[];
  severity: 'error' | 'warning' | 'info';
}

export interface GovernanceRule {
  id: string;
  description: string;
  scope: 'service-manifest' | 'provider-config' | 'runtime-operation';
  condition: string;
  action: 'block' | 'warn' | 'audit';
  enabled: boolean;
}

export interface EnforcementResult {
  compliant: boolean;
  violations: PolicyViolation[];
  warnings: PolicyWarning[];
  auditLog: AuditLog[];
}

export interface PolicyViolation {
  ruleId: string;
  policyName: string;
  description: string;
  scope: string;
  severity: string;
  timestamp: Date;
  affectedResource: string;
}

export interface PolicyWarning {
  ruleId: string;
  policyName: string;
  description: string;
  scope: string;
  timestamp: Date;
  affectedResource: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  resource: string;
  result: 'compliant' | 'non-compliant';
  details?: Record<string, any>;
}

export interface EnforcementOptions {
  blockOnViolation?: boolean;
  logWarnings?: boolean;
  auditMode?: boolean;
}

export class GovernanceEnforcerService extends EventEmitter {
  private policies: Map<string, GovernancePolicy> = new Map();
  private manifestValidator: ServiceManifestValidator;
  private auditLogs: AuditLog[] = [];
  private governancePath: string;

  constructor(governancePath: string = './governance') {
    super();
    this.governancePath = governancePath;
    this.manifestValidator = new ServiceManifestValidator();
  }

  /**
   * Initialize the governance enforcer
   */
  async initialize(): Promise<void> {
    logger.info('Initializing governance enforcer');

    try {
      // Load governance policies
      await this.loadPolicies();

      logger.info({ 
        policiesLoaded: this.policies.size 
      }, 'Governance enforcer initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize governance enforcer');
      throw error;
    }
  }

  /**
   * Load governance policies from governance directory
   */
  async loadPolicies(): Promise<void> {
    logger.info({ path: this.governancePath }, 'Loading governance policies');

    try {
      // Check if governance directory exists
      const exists = await fs.access(this.governancePath).then(() => true).catch(() => false);
      if (!exists) {
        logger.warn({ path: this.governancePath }, 'Governance directory not found');
        return;
      }

      // Load policy files
      const entries = await fs.readdir(this.governancePath, { withFileTypes: true });
      const policyFiles = entries.filter(entry => 
        entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))
      );

      for (const file of policyFiles) {
        const filePath = path.join(this.governancePath, file.name);
        await this.loadPolicyFile(filePath);
      }

      logger.info({ 
        count: policyFiles.length,
        policiesLoaded: this.policies.size 
      }, 'Governance policies loaded');
    } catch (error) {
      logger.error({ error }, 'Failed to load governance policies');
      throw error;
    }
  }

  /**
   * Load a single policy file
   */
  async loadPolicyFile(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const policy = yaml.load(content) as GovernancePolicy;

      if (policy.name && policy.rules) {
        this.policies.set(policy.name, policy);
        logger.info({ policyName: policy.name, filePath }, 'Governance policy loaded');
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to load policy file');
      throw error;
    }
  }

  /**
   * Enforce governance policies on a service manifest
   */
  async enforceServiceManifest(
    manifest: ServiceManifest,
    options: EnforcementOptions = {}
  ): Promise<EnforcementResult> {
    logger.info({ 
      service: manifest.metadata.name,
      options 
    }, 'Enforcing governance policies on service manifest');

    const result: EnforcementResult = {
      compliant: true,
      violations: [],
      warnings: [],
      auditLog: []
    };

    try {
      // Validate manifest structure
      const validation = await this.manifestValidator.validate(manifest);
      if (!validation.valid) {
        result.compliant = false;
        result.violations.push({
          ruleId: 'manifest-validation',
          policyName: 'service-manifest-policy',
          description: 'Service manifest validation failed',
          scope: 'service-manifest',
          severity: 'error',
          timestamp: new Date(),
          affectedResource: manifest.metadata.name
        });
      }

      // Apply governance policies
      for (const [policyName, policy] of this.policies) {
        const policyResult = await this.enforcePolicy(manifest, policy, options);
        
        if (!policyResult.compliant) {
          result.compliant = false;
        }

        result.violations.push(...policyResult.violations);
        result.warnings.push(...policyResult.warnings);
      }

      // Create audit log entry
      const auditLog: AuditLog = {
        id: this.generateAuditId(),
        timestamp: new Date(),
        action: 'service-manifest-validation',
        resource: manifest.metadata.name,
        result: result.compliant ? 'compliant' : 'non-compliant',
        details: {
          violations: result.violations.length,
          warnings: result.warnings.length
        }
      };

      result.auditLog.push(auditLog);
      this.auditLogs.push(auditLog);

      // Emit enforcement event
      this.emit('enforcement:completed', {
        resource: manifest.metadata.name,
        result: result.compliant ? 'compliant' : 'non-compliant',
        violations: result.violations.length,
        warnings: result.warnings.length
      });

      // Block if configured and violations found
      if (options.blockOnViolation && !result.compliant) {
        throw new Error(
          `Service manifest governance enforcement failed: ${result.violations.length} violations`
        );
      }

      logger.info({ 
        service: manifest.metadata.name,
        compliant: result.compliant,
        violations: result.violations.length,
        warnings: result.warnings.length 
      }, 'Governance enforcement completed');

      return result;
    } catch (error) {
      logger.error({ 
        service: manifest.metadata.name,
        error 
      }, 'Governance enforcement failed');

      const auditLog: AuditLog = {
        id: this.generateAuditId(),
        timestamp: new Date(),
        action: 'service-manifest-validation',
        resource: manifest.metadata.name,
        result: 'non-compliant',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };

      result.auditLog.push(auditLog);
      this.auditLogs.push(auditLog);

      if (options.blockOnViolation) {
        throw error;
      }

      return result;
    }
  }

  /**
   * Enforce a specific policy
   */
  private async enforcePolicy(
    manifest: ServiceManifest,
    policy: GovernancePolicy,
    options: EnforcementOptions
  ): Promise<EnforcementResult> {
    const result: EnforcementResult = {
      compliant: true,
      violations: [],
      warnings: [],
      auditLog: []
    };

    for (const rule of policy.rules) {
      if (!rule.enabled) {
        continue;
      }

      if (rule.scope === 'service-manifest') {
        const ruleResult = await this.evaluateRule(manifest, rule, policy.name, policy.severity, options);
        
        if (!ruleResult.compliant) {
          result.compliant = false;
        }

        result.violations.push(...ruleResult.violations);
        result.warnings.push(...ruleResult.warnings);
      }
    }

    return result;
  }

  /**
   * Evaluate a governance rule
   */
  private async evaluateRule(
    manifest: ServiceManifest,
    rule: GovernanceRule,
    policyName: string,
    policySeverity: 'error' | 'warning' | 'info',
    options: EnforcementOptions
  ): Promise<EnforcementResult> {
    const result: EnforcementResult = {
      compliant: true,
      violations: [],
      warnings: [],
      auditLog: []
    };

    try {
      // Evaluate rule condition
      const conditionMet = await this.evaluateCondition(rule.condition, manifest);

      if (conditionMet) {
        const timestamp = new Date();
        const affectedResource = manifest.metadata.name;

        if (rule.action === 'block') {
          result.compliant = false;
          result.violations.push({
            ruleId: rule.id,
            policyName,
            description: rule.description,
            scope: rule.scope,
            severity: policySeverity,
            timestamp,
            affectedResource
          });
        } else if (rule.action === 'warn' && options.logWarnings !== false) {
          result.warnings.push({
            ruleId: rule.id,
            policyName,
            description: rule.description,
            scope: rule.scope,
            timestamp,
            affectedResource
          });
        } else if (rule.action === 'audit') {
          // Just audit, no action needed
        }
      }
    } catch (error) {
      logger.error({ ruleId: rule.id, error }, 'Rule evaluation failed');
      result.compliant = false;
      result.violations.push({
        ruleId: rule.id,
        policyName,
        description: `Rule evaluation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        scope: rule.scope,
        severity: 'error',
        timestamp: new Date(),
        affectedResource: manifest.metadata.name
      });
    }

    return result;
  }

  /**
   * Evaluate rule condition (basic implementation)
   */
  private async evaluateCondition(condition: string, manifest: ServiceManifest): Promise<boolean> {
    // This is a simplified implementation
    // In a real implementation, this would use a rule engine like JSONata or similar
    
    try {
      // Simple string-based condition evaluation
      if (condition.includes('runtimeMode === "native"')) {
        return manifest.spec.runtimeMode === 'native';
      }
      
      if (condition.includes('runtimeMode === "connected"')) {
        return manifest.spec.runtimeMode === 'connected';
      }

      if (condition.includes('capabilities.length > 0')) {
        return manifest.spec.capabilities.length > 0;
      }

      if (condition.includes('fallbackEnabled')) {
        return manifest.spec.capabilities.some(cap => cap.fallbackEnabled);
      }

      // Default to false for unsupported conditions
      logger.warn({ condition }, 'Unsupported condition, defaulting to false');
      return false;
    } catch (error) {
      logger.error({ condition, error }, 'Condition evaluation failed');
      return false;
    }
  }

  /**
   * Get audit logs
   */
  getAuditLogs(limit?: number): AuditLog[] {
    if (limit) {
      return this.auditLogs.slice(-limit);
    }
    return [...this.auditLogs];
  }

  /**
   * Clear audit logs
   */
  clearAuditLogs(): void {
    this.auditLogs = [];
    logger.info('Audit logs cleared');
  }

  /**
   * Get loaded policies
   */
  getPolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get a specific policy
   */
  getPolicy(name: string): GovernancePolicy | undefined {
    return this.policies.get(name);
  }

  /**
   * Add a policy
   */
  addPolicy(policy: GovernancePolicy): void {
    this.policies.set(policy.name, policy);
    logger.info({ policyName: policy.name }, 'Governance policy added');
  }

  /**
   * Remove a policy
   */
  removePolicy(name: string): boolean {
    const removed = this.policies.delete(name);
    if (removed) {
      logger.info({ policyName: name }, 'Governance policy removed');
    }
    return removed;
  }

  /**
   * Generate audit ID
   */
  private generateAuditId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get governance statistics
   */
  getStatistics(): {
    totalPolicies: number;
    enabledRules: number;
    totalAuditLogs: number;
    complianceRate: number;
  } {
    const enabledRules = Array.from(this.policies.values())
      .reduce((sum, policy) => sum + policy.rules.filter(r => r.enabled).length, 0);

    const compliantAudits = this.auditLogs.filter(log => log.result === 'compliant').length;
    const complianceRate = this.auditLogs.length > 0 
      ? (compliantAudits / this.auditLogs.length) * 100 
      : 100;

    return {
      totalPolicies: this.policies.size,
      enabledRules,
      totalAuditLogs: this.auditLogs.length,
      complianceRate: Math.round(complianceRate * 100) / 100
    };
  }
}

// Export singleton instance
export const governanceEnforcerService = new GovernanceEnforcerService();