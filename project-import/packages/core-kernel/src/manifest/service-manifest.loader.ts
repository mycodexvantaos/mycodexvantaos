/**
 * Service Manifest Loader
 * 
 * High-level service for loading, validating, and managing service manifests.
 * Integrates parser, validator, and provides lifecycle management for manifests.
 */

import pino from 'pino';
import { ServiceManifestParser } from './service-manifest.parser';
import { ServiceManifestValidator } from './service-manifest.validator';
import {
  ServiceManifest,
  ServiceManifestValidationResult,
  ServiceManifestContext,
  ManifestLoadOptions
} from './service-manifest.types';

const logger = pino({ name: 'service-manifest-loader' });

export interface ManifestLoadResult {
  success: boolean;
  context?: ServiceManifestContext;
  validation?: ServiceManifestValidationResult;
  error?: string;
}

export interface ManifestRegistry {
  [serviceName: string]: {
    manifest: ServiceManifest;
    context: ServiceManifestContext;
    validation: ServiceManifestValidationResult;
    loadedAt: Date;
  };
}

export class ServiceManifestLoader {
  private parser: ServiceManifestParser;
  private validator: ServiceManifestValidator;
  private manifestRegistry: ManifestRegistry = {};

  constructor() {
    this.parser = new ServiceManifestParser();
    this.validator = new ServiceManifestValidator();
  }

  /**
   * Load and validate a single service manifest
   */
  async loadManifest(
    source: string,
    options: ManifestLoadOptions = {}
  ): Promise<ManifestLoadResult> {
    try {
      logger.info({ source, options }, 'Loading service manifest');

      // Load manifest
      const context = await this.loadFromSource(source, options);

      // Validate if required
      let validation: ServiceManifestValidationResult | undefined;
      if (options.validate !== false) {
        validation = await this.validator.validate(context.manifest);

        if (!validation.valid) {
          logger.warn({ 
            name: context.manifest.metadata.name,
            errors: validation.errors 
          }, 'Service manifest validation failed');

          return {
            success: false,
            context,
            validation,
            error: `Validation failed: ${validation.errors.join(', ')}`
          };
        }
      }

      // Store in registry
      this.manifestRegistry[context.manifest.metadata.name] = {
        manifest: context.manifest,
        context,
        validation: validation!,
        loadedAt: new Date()
      };

      logger.info({ 
        name: context.manifest.metadata.name,
        runtimeMode: context.manifest.spec.runtimeMode 
      }, 'Service manifest loaded and validated successfully');

      return {
        success: true,
        context,
        validation
      };
    } catch (error) {
      logger.error({ source, error }, 'Failed to load service manifest');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Load multiple service manifests from a directory
   */
  async loadManifestsFromDirectory(
    directory: string,
    options: ManifestLoadOptions = {}
  ): Promise<ManifestLoadResult[]> {
    try {
      logger.info({ directory, options }, 'Loading service manifests from directory');

      const contexts = await this.parser.loadFromDirectory(directory, options);
      const results: ManifestLoadResult[] = [];

      for (const context of contexts) {
        const result = await this.loadManifestFromContext(context, options);
        results.push(result);
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      logger.info({ 
        directory, 
        total: results.length,
        successful,
        failed 
      }, 'Service manifests loading completed');

      return results;
    } catch (error) {
      logger.error({ directory, error }, 'Failed to load service manifests from directory');
      throw error;
    }
  }

  /**
   * Get a loaded manifest by service name
   */
  getManifest(serviceName: string): ServiceManifest | undefined {
    const entry = this.manifestRegistry[serviceName];
    return entry?.manifest;
  }

  /**
   * Get manifest context by service name
   */
  getManifestContext(serviceName: string): ServiceManifestContext | undefined {
    const entry = this.manifestRegistry[serviceName];
    return entry?.context;
  }

  /**
   * Get manifest validation result by service name
   */
  getManifestValidation(serviceName: string): ServiceManifestValidationResult | undefined {
    const entry = this.manifestRegistry[serviceName];
    return entry?.validation;
  }

  /**
   * Get all loaded manifests
   */
  getAllManifests(): ServiceManifest[] {
    return Object.values(this.manifestRegistry).map(entry => entry.manifest);
  }

  /**
   * Get all manifest contexts
   */
  getAllManifestContexts(): ServiceManifestContext[] {
    return Object.values(this.manifestRegistry).map(entry => entry.context);
  }

  /**
   * Reload a manifest
   */
  async reloadManifest(serviceName: string, options: ManifestLoadOptions = {}): Promise<ManifestLoadResult> {
    try {
      const entry = this.manifestRegistry[serviceName];
      if (!entry) {
        throw new Error(`Manifest not found for service: ${serviceName}`);
      }

      logger.info({ serviceName }, 'Reloading service manifest');

      // Reload from the original source
      const result = await this.loadManifest(entry.context.loadedFrom, options);

      if (result.success) {
        logger.info({ serviceName }, 'Service manifest reloaded successfully');
      } else {
        logger.warn({ serviceName, error: result.error }, 'Service manifest reload failed');
      }

      return result;
    } catch (error) {
      logger.error({ serviceName, error }, 'Failed to reload service manifest');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remove a manifest from the registry
   */
  removeManifest(serviceName: string): boolean {
    const entry = this.manifestRegistry[serviceName];
    if (entry) {
      delete this.manifestRegistry[serviceName];
      logger.info({ serviceName }, 'Service manifest removed from registry');
      return true;
    }
    return false;
  }

  /**
   * Clear all manifests from the registry
   */
  clearManifests(): void {
    this.manifestRegistry = {};
    logger.info('All service manifests cleared from registry');
  }

  /**
   * Validate all loaded manifests
   */
  async validateAllManifests(): Promise<Map<string, ServiceManifestValidationResult>> {
    const results = new Map<string, ServiceManifestValidationResult>();

    for (const serviceName of Object.keys(this.manifestRegistry)) {
      const entry = this.manifestRegistry[serviceName];
      try {
        const validation = await this.validator.validate(entry.manifest);
        results.set(serviceName, validation);
      } catch (error) {
        results.set(serviceName, {
          valid: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
          warnings: []
        });
      }
    }

    return results;
  }

  /**
   * Get manifest statistics
   */
  getManifestStats(): {
    total: number;
    valid: number;
    invalid: number;
    byRuntimeMode: Record<string, number>;
  } {
    const stats = {
      total: Object.keys(this.manifestRegistry).length,
      valid: 0,
      invalid: 0,
      byRuntimeMode: {} as Record<string, number>
    };

    for (const entry of Object.values(this.manifestRegistry)) {
      if (entry.validation?.valid) {
        stats.valid++;
      } else {
        stats.invalid++;
      }

      const runtimeMode = entry.manifest.spec.runtimeMode;
      stats.byRuntimeMode[runtimeMode] = (stats.byRuntimeMode[runtimeMode] || 0) + 1;
    }

    return stats;
  }

  /**
   * Load from source helper
   */
  private async loadFromSource(
    source: string,
    options: ManifestLoadOptions
  ): Promise<ServiceManifestContext> {
    const stat = require('fs').statSync(source);
    if (stat.isDirectory()) {
      throw new Error('Source is a directory. Use loadManifestsFromDirectory instead.');
    }

    return await this.parser.loadFromFile(source, options);
  }

  /**
   * Load from context helper
   */
  private async loadManifestFromContext(
    context: ServiceManifestContext,
    options: ManifestLoadOptions
  ): Promise<ManifestLoadResult> {
    try {
      // Validate if required
      let validation: ServiceManifestValidationResult | undefined;
      if (options.validate !== false) {
        validation = await this.validator.validate(context.manifest);

        if (!validation.valid) {
          return {
            success: false,
            context,
            validation,
            error: `Validation failed: ${validation.errors.join(', ')}`
          };
        }
      }

      // Store in registry
      this.manifestRegistry[context.manifest.metadata.name] = {
        manifest: context.manifest,
        context,
        validation: validation!,
        loadedAt: new Date()
      };

      return {
        success: true,
        context,
        validation
      };
    } catch (error) {
      return {
        success: false,
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const serviceManifestLoader = new ServiceManifestLoader();