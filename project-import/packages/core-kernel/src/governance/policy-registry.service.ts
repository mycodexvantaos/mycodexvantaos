/**
 * Policy Registry Service
 * 
 * Central registry for managing governance policies across the platform.
 * Handles policy loading, registration, updates, and distribution to enforcement engines.
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GovernancePolicy } from './governance-enforcer.service';

const logger = pino({ name: 'policy-registry' });

export interface PolicyRegistration {
  policy: GovernancePolicy;
  registeredAt: Date;
  updatedAt: Date;
  source: string;
  version: string;
  enabled: boolean;
}

export interface PolicySubscription {
  subscriberId: string;
  policyName: string;
  callback: (policy: GovernancePolicy) => void;
}

export class PolicyRegistryService extends EventEmitter {
  private policies: Map<string, PolicyRegistration> = new Map();
  private subscriptions: PolicySubscription[] = [];
  private policyPath: string;
  private watchEnabled: boolean = false;

  constructor(policyPath: string = './governance') {
    super();
    this.policyPath = policyPath;
  }

  /**
   * Initialize the policy registry
   */
  async initialize(): Promise<void> {
    logger.info('Initializing policy registry');

    try {
      // Load policies from governance directory
      await this.loadPoliciesFromDirectory();

      logger.info({ 
        policiesLoaded: this.policies.size 
      }, 'Policy registry initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize policy registry');
      throw error;
    }
  }

  /**
   * Load policies from governance directory
   */
  async loadPoliciesFromDirectory(): Promise<void> {
    logger.info({ path: this.policyPath }, 'Loading policies from directory');

    try {
      const exists = await fs.access(this.policyPath).then(() => true).catch(() => false);
      if (!exists) {
        logger.warn({ path: this.policyPath }, 'Policy directory not found');
        return;
      }

      const entries = await fs.readdir(this.policyPath, { withFileTypes: true });
      const policyFiles = entries.filter(entry => 
        entry.isFile() && (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml'))
      );

      for (const file of policyFiles) {
        const filePath = path.join(this.policyPath, file.name);
        try {
          await this.loadPolicy(filePath);
        } catch (error) {
          logger.error({ filePath, error }, 'Failed to load policy file');
        }
      }

      logger.info({ 
        loaded: policyFiles.length,
        registered: this.policies.size 
      }, 'Policies loaded from directory');
    } catch (error) {
      logger.error({ error }, 'Failed to load policies from directory');
      throw error;
    }
  }

  /**
   * Load a policy from file
   */
  async loadPolicy(filePath: string): Promise<void> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const policy = yaml.load(content) as GovernancePolicy;

      if (!policy.name) {
        throw new Error('Policy missing required field: name');
      }

      if (!policy.version) {
        throw new Error('Policy missing required field: version');
      }

      if (!policy.rules || !Array.isArray(policy.rules)) {
        throw new Error('Policy missing required field: rules');
      }

      const registration: PolicyRegistration = {
        policy,
        registeredAt: new Date(),
        updatedAt: new Date(),
        source: filePath,
        version: policy.version,
        enabled: true
      };

      // Check if policy already exists
      const existing = this.policies.get(policy.name);
      if (existing && existing.version === policy.version) {
        logger.debug({ policyName: policy.name }, 'Policy already registered, skipping');
        return;
      }

      this.policies.set(policy.name, registration);

      // Notify subscribers
      await this.notifySubscribers(policy);

      // Emit registration event
      this.emit('policy:registered', { 
        policyName: policy.name, 
        version: policy.version,
        source: filePath 
      });

      logger.info({ 
        policyName: policy.name,
        version: policy.version,
        source: filePath 
      }, 'Policy loaded and registered');
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to load policy');
      throw error;
    }
  }

  /**
   * Register a policy programmatically
   */
  registerPolicy(policy: GovernancePolicy, source: string = 'programmatic'): void {
    if (!policy.name || !policy.version || !policy.rules) {
      throw new Error('Invalid policy: missing required fields');
    }

    const registration: PolicyRegistration = {
      policy,
      registeredAt: new Date(),
      updatedAt: new Date(),
      source,
      version: policy.version,
      enabled: true
    };

    this.policies.set(policy.name, registration);

    // Notify subscribers asynchronously
    this.notifySubscribers(policy).catch(error => {
      logger.error({ policyName: policy.name, error }, 'Failed to notify subscribers');
    });

    // Emit registration event
    this.emit('policy:registered', { 
      policyName: policy.name, 
      version: policy.version,
      source 
    });

    logger.info({ 
      policyName: policy.name,
      version: policy.version,
      source 
    }, 'Policy registered programmatically');
  }

  /**
   * Update a policy
   */
  updatePolicy(policyName: string, updates: Partial<GovernancePolicy>): void {
    const registration = this.policies.get(policyName);
    if (!registration) {
      throw new Error(`Policy not found: ${policyName}`);
    }

    // Update policy fields
    Object.assign(registration.policy, updates);
    registration.updatedAt = new Date();
    registration.version = updates.version || registration.version;

    // Notify subscribers
    this.notifySubscribers(registration.policy).catch(error => {
      logger.error({ policyName, error }, 'Failed to notify subscribers of update');
    });

    // Emit update event
    this.emit('policy:updated', { 
      policyName, 
      version: registration.version 
    });

    logger.info({ 
      policyName, 
      version: registration.version 
    }, 'Policy updated');
  }

  /**
   * Unregister a policy
   */
  unregisterPolicy(policyName: string): boolean {
    const registration = this.policies.get(policyName);
    if (!registration) {
      return false;
    }

    this.policies.delete(policyName);

    // Remove subscriptions for this policy
    this.subscriptions = this.subscriptions.filter(
      sub => sub.policyName !== policyName
    );

    // Emit unregistration event
    this.emit('policy:unregistered', { 
      policyName,
      version: registration.version 
    });

    logger.info({ policyName }, 'Policy unregistered');
    return true;
  }

  /**
   * Get a policy
   */
  getPolicy(policyName: string): GovernancePolicy | undefined {
    const registration = this.policies.get(policyName);
    return registration?.policy;
  }

  /**
   * Get policy registration
   */
  getPolicyRegistration(policyName: string): PolicyRegistration | undefined {
    return this.policies.get(policyName);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values())
      .filter(reg => reg.enabled)
      .map(reg => reg.policy);
  }

  /**
   * Get all enabled policies
   */
  getEnabledPolicies(): GovernancePolicy[] {
    return Array.from(this.policies.values())
      .filter(reg => reg.enabled)
      .map(reg => reg.policy);
  }

  /**
   * Enable a policy
   */
  enablePolicy(policyName: string): void {
    const registration = this.policies.get(policyName);
    if (!registration) {
      throw new Error(`Policy not found: ${policyName}`);
    }

    registration.enabled = true;

    this.emit('policy:enabled', { policyName });
    logger.info({ policyName }, 'Policy enabled');
  }

  /**
   * Disable a policy
   */
  disablePolicy(policyName: string): void {
    const registration = this.policies.get(policyName);
    if (!registration) {
      throw new Error(`Policy not found: ${policyName}`);
    }

    registration.enabled = false;

    this.emit('policy:disabled', { policyName });
    logger.info({ policyName }, 'Policy disabled');
  }

  /**
   * Subscribe to policy updates
   */
  subscribeToPolicy(subscriberId: string, policyName: string, callback: (policy: GovernancePolicy) => void): void {
    const subscription: PolicySubscription = {
      subscriberId,
      policyName,
      callback
    };

    this.subscriptions.push(subscription);

    logger.info({ 
      subscriberId, 
      policyName 
    }, 'Subscribed to policy updates');
  }

  /**
   * Unsubscribe from policy updates
   */
  unsubscribeFromPolicy(subscriberId: string, policyName: string): void {
    const initialLength = this.subscriptions.length;
    this.subscriptions = this.subscriptions.filter(
      sub => !(sub.subscriberId === subscriberId && sub.policyName === policyName)
    );

    if (this.subscriptions.length < initialLength) {
      logger.info({ 
        subscriberId, 
        policyName 
      }, 'Unsubscribed from policy updates');
    }
  }

  /**
   * Notify subscribers of a policy change
   */
  private async notifySubscribers(policy: GovernancePolicy): Promise<void> {
    const subscriptions = this.subscriptions.filter(
      sub => sub.policyName === policy.name
    );

    for (const subscription of subscriptions) {
      try {
        subscription.callback(policy);
      } catch (error) {
        logger.error({ 
          subscriberId: subscription.subscriberId,
          policyName: policy.name,
          error 
        }, 'Failed to notify subscriber');
      }
    }
  }

  /**
   * Reload policies from directory
   */
  async reloadPolicies(): Promise<void> {
    logger.info('Reloading policies from directory');

    try {
      await this.loadPoliciesFromDirectory();
      
      this.emit('policies:reloaded', { 
        count: this.policies.size 
      });
      
      logger.info({ 
        count: this.policies.size 
      }, 'Policies reloaded successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to reload policies');
      throw error;
    }
  }

  /**
   * Get registry statistics
   */
  getStatistics(): {
    totalPolicies: number;
    enabledPolicies: number;
    disabledPolicies: number;
    subscriptions: number;
  } {
    const enabled = Array.from(this.policies.values()).filter(reg => reg.enabled).length;
    const disabled = this.policies.size - enabled;

    return {
      totalPolicies: this.policies.size,
      enabledPolicies: enabled,
      disabledPolicies: disabled,
      subscriptions: this.subscriptions.length
    };
  }

  /**
   * Export policies to directory
   */
  async exportPolicies(directory: string): Promise<void> {
    logger.info({ directory }, 'Exporting policies to directory');

    try {
      // Ensure directory exists
      await fs.mkdir(directory, { recursive: true });

      // Export each policy
      for (const registration of this.policies.values()) {
        const filePath = path.join(directory, `${registration.policy.name}.yaml`);
        const content = yaml.dump(registration.policy, {
          indent: 2,
          lineWidth: -1
        });
        await fs.writeFile(filePath, content, 'utf-8');
      }

      logger.info({ 
        directory,
        count: this.policies.size 
      }, 'Policies exported successfully');
    } catch (error) {
      logger.error({ directory, error }, 'Failed to export policies');
      throw error;
    }
  }

  /**
   * Clear all policies
   */
  clearPolicies(): void {
    const policyNames = Array.from(this.policies.keys());
    this.policies.clear();
    this.subscriptions = [];

    this.emit('policies:cleared', { count: policyNames.length });
    logger.info({ count: policyNames.length }, 'All policies cleared');
  }
}

// Export singleton instance
export const policyRegistryService = new PolicyRegistryService();