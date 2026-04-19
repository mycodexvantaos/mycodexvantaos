/**
 * Service Manifest Parser
 * 
 * Handles parsing and loading of service manifest files with support for
 * multiple formats (YAML, JSON) and validation against the governance policy.
 */

import pino from 'pino';
import * as yaml from 'js-yaml';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ServiceManifest,
  ServiceManifestValidationResult,
  ManifestLoadOptions,
  ServiceManifestContext
} from './service-manifest.types';

const logger = pino({ name: 'service-manifest-parser' });

export class ServiceManifestParser {
  /**
   * Parse service manifest from string content
   */
  async parse(content: string, format: 'yaml' | 'json'): Promise<ServiceManifest> {
    try {
      let manifest: any;

      if (format === 'yaml') {
        manifest = yaml.load(content);
      } else {
        manifest = JSON.parse(content);
      }

      // Basic structure validation
      if (!manifest || typeof manifest !== 'object') {
        throw new Error('Invalid manifest: not an object');
      }

      if (!manifest.apiVersion) {
        throw new Error('Invalid manifest: missing apiVersion');
      }

      if (!manifest.kind) {
        throw new Error('Invalid manifest: missing kind');
      }

      if (manifest.kind !== 'ServiceManifest') {
        throw new Error(`Invalid manifest: kind must be ServiceManifest, got ${manifest.kind}`);
      }

      logger.info({ 
        apiVersion: manifest.apiVersion, 
        name: manifest.metadata?.name 
      }, 'Service manifest parsed successfully');

      return manifest as ServiceManifest;
    } catch (error) {
      logger.error({ error }, 'Failed to parse service manifest');
      throw new Error(`Manifest parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load service manifest from file
   */
  async loadFromFile(filePath: string, options: ManifestLoadOptions = {}): Promise<ServiceManifestContext> {
    try {
      logger.info({ filePath }, 'Loading service manifest from file');

      const content = await fs.readFile(filePath, 'utf-8');
      const ext = path.extname(filePath).toLowerCase();
      const format = ext === '.json' ? 'json' : 'yaml';

      const manifest = await this.parse(content, format);

      const context: ServiceManifestContext = {
        manifest,
        loadedFrom: filePath,
        loadedAt: new Date(),
        environment: process.env.NODE_ENV || 'development'
      };

      logger.info({ 
        name: manifest.metadata.name, 
        runtimeMode: manifest.spec.runtimeMode 
      }, 'Service manifest loaded successfully');

      return context;
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to load service manifest from file');
      throw error;
    }
  }

  /**
   * Load service manifest from directory
   */
  async loadFromDirectory(dirPath: string, options: ManifestLoadOptions = {}): Promise<ServiceManifestContext[]> {
    try {
      logger.info({ dirPath }, 'Loading service manifests from directory');

      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const manifestFiles = entries.filter(entry => {
        const name = entry.name.toLowerCase();
        return (name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.json')) &&
               entry.isFile();
      });

      const manifests: ServiceManifestContext[] = [];

      for (const file of manifestFiles) {
        const filePath = path.join(dirPath, file.name);
        try {
          const context = await this.loadFromFile(filePath, options);
          manifests.push(context);
        } catch (error) {
          logger.warn({ filePath, error }, 'Failed to load manifest file, skipping');
        }
      }

      logger.info({ 
        directory: dirPath, 
        count: manifests.length 
      }, 'Service manifests loaded from directory');

      return manifests;
    } catch (error) {
      logger.error({ dirPath, error }, 'Failed to load service manifests from directory');
      throw error;
    }
  }

  /**
   * Serialize service manifest to string
   */
  async serialize(manifest: ServiceManifest, format: 'yaml' | 'json'): Promise<string> {
    try {
      if (format === 'yaml') {
        return yaml.dump(manifest, {
          indent: 2,
          lineWidth: -1,
          noRefs: true,
          sortKeys: false
        });
      } else {
        return JSON.stringify(manifest, null, 2);
      }
    } catch (error) {
      logger.error({ error }, 'Failed to serialize service manifest');
      throw new Error(`Manifest serialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save service manifest to file
   */
  async saveToFile(manifest: ServiceManifest, filePath: string): Promise<void> {
    try {
      logger.info({ filePath, name: manifest.metadata.name }, 'Saving service manifest to file');

      const ext = path.extname(filePath).toLowerCase();
      const format = ext === '.json' ? 'json' : 'yaml';
      const content = await this.serialize(manifest, format);

      await fs.writeFile(filePath, content, 'utf-8');

      logger.info({ filePath }, 'Service manifest saved successfully');
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to save service manifest to file');
      throw error;
    }
  }

  /**
   * Detect format from filename
   */
  detectFormat(filename: string): 'yaml' | 'json' {
    const ext = path.extname(filename).toLowerCase();
    return ext === '.json' ? 'json' : 'yaml';
  }
}