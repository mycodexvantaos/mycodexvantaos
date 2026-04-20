/**
 * MyCodexVantaOS File-Based Secrets Provider
 * 
 * Native file-based secrets provider implementing the SecretsProvider interface
 * Following naming-spec-v1 §8.1: secrets-file
 * 
 * @package @mycodexvantaos/secrets-file
 * @version 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  SecretsProvider,
  HealthCheckResult,
  ProviderSource,
  ProviderCriticality,
  ResolvedMode,
} from '@mycodexvantaos/namespaces-sdk';

/**
 * File secrets provider configuration
 */
export interface FileSecretsConfig {
  /** Base directory for secrets storage (default: ./data/secrets) */
  basePath?: string;
  /** Encryption key (hex string, 32 bytes for AES-256) */
  encryptionKey?: string;
  /** Enable encryption at rest */
  enableEncryption?: boolean;
  /** Create base directory if it doesn't exist */
  createBasePath?: boolean;
  /** Enable audit logging */
  enableAuditLog?: boolean;
}

/**
 * Audit log entry
 */
interface AuditLogEntry {
  timestamp: Date;
  action: 'get' | 'set' | 'delete' | 'list';
  key: string;
  success: boolean;
  error?: string;
}

/**
 * Encrypted secret payload
 */
interface EncryptedPayload {
  iv: string;
  authTag: string;
  data: string;
  version: number;
}

/**
 * File-Based Secrets Provider
 * 
 * Provides native secrets management capability for MyCodexVantaOS
 * with optional encryption at rest
 */
export class FileSecretsProvider implements SecretsProvider {
  readonly capability = 'secrets' as const;
  readonly source: ProviderSource = 'native';
  readonly criticality: ProviderCriticality = 'critical';
  readonly supportsModes: ResolvedMode[] = ['native', 'hybrid'];

  private config: FileSecretsConfig;
  private basePath: string;
  private encryptionKey: Buffer | null = null;
  private initialized: boolean = false;
  private auditLog: AuditLogEntry[] = [];

  constructor(config: FileSecretsConfig = {}) {
    this.config = config;
    this.basePath = config.basePath || path.join(process.cwd(), 'data', 'secrets');
  }

  /**
   * Initialize the secrets provider
   */
  async initialize(config?: unknown): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Merge configuration
    const finalConfig: FileSecretsConfig = {
      ...this.config,
      ...(config as FileSecretsConfig || {}),
    };

    this.basePath = finalConfig.basePath || this.basePath;

    // Create base directory if needed
    if (finalConfig.createBasePath !== false) {
      await fs.promises.mkdir(this.basePath, { recursive: true });
      // Set restrictive permissions
      await fs.promises.chmod(this.basePath, 0o700);
    }

    // Setup encryption key
    if (finalConfig.enableEncryption !== false) {
      if (finalConfig.encryptionKey) {
        this.encryptionKey = Buffer.from(finalConfig.encryptionKey, 'hex');
        if (this.encryptionKey.length !== 32) {
          throw new Error('Encryption key must be 32 bytes (64 hex characters) for AES-256');
        }
      } else {
        // Generate or load key
        this.encryptionKey = await this.getOrCreateEncryptionKey();
      }
    }

    this.initialized = true;
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        message: 'Secrets provider not initialized',
      };
    }

    try {
      // Test read/write access
      const testKey = '.health-check-' + Date.now();
      const testPath = this.resolvePath(testKey);
      
      await fs.promises.writeFile(testPath, 'test', { mode: 0o600 });
      await fs.promises.readFile(testPath);
      await fs.promises.unlink(testPath);

      return {
        status: 'healthy',
        timestamp: new Date(),
        message: 'Secrets provider is responsive',
        details: {
          basePath: this.basePath,
          encryptionEnabled: this.encryptionKey !== null,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        message: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }

  /**
   * Get a secret by key
   */
  async getSecret(key: string): Promise<string> {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);
    
    try {
      const data = await fs.promises.readFile(filePath, 'utf-8');
      
      let secret: string;
      if (this.encryptionKey) {
        secret = this.decrypt(data);
      } else {
        secret = data;
      }

      this.logAudit('get', key, true);
      return secret;
    } catch (error) {
      this.logAudit('get', key, false, error instanceof Error ? error.message : 'Unknown error');
      
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`Secret not found: ${key}`);
      }
      throw error;
    }
  }

  /**
   * Set a secret
   */
  async setSecret(key: string, value: string): Promise<void> {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);
    const dir = path.dirname(filePath);

    // Create directory if needed
    await fs.promises.mkdir(dir, { recursive: true });

    // Encrypt if enabled
    const data = this.encryptionKey ? this.encrypt(value) : value;

    // Write with restrictive permissions
    await fs.promises.writeFile(filePath, data, { mode: 0o600 });

    this.logAudit('set', key, true);
  }

  /**
   * Delete a secret
   */
  async deleteSecret(key: string): Promise<void> {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);

    try {
      await fs.promises.unlink(filePath);
      this.logAudit('delete', key, true);
    } catch (error) {
      this.logAudit('delete', key, false, error instanceof Error ? error.message : 'Unknown error');
      
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * List all secret keys
   */
  async listSecrets(): Promise<string[]> {
    this.ensureInitialized();

    const keys: string[] = [];

    const walk = async (dir: string) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (entry.isFile()) {
          const relativePath = path.relative(this.basePath, fullPath);
          const key = relativePath.split(path.sep).join('/');
          keys.push(key);
        }
      }
    };

    try {
      await walk(this.basePath);
    } catch {
      // Directory might not exist yet
    }

    this.logAudit('list', '*', true);
    return keys;
  }

  /**
   * Check if a secret exists
   */
  async hasSecret(key: string): Promise<boolean> {
    this.ensureInitialized();
    this.validateKey(key);

    const filePath = this.resolvePath(key);

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get a secret as JSON
   */
  async getSecretJson<T = unknown>(key: string): Promise<T> {
    const value = await this.getSecret(key);
    return JSON.parse(value);
  }

  /**
   * Set a secret from JSON
   */
  async setSecretJson(key: string, value: unknown): Promise<void> {
    const json = JSON.stringify(value, null, 2);
    await this.setSecret(key, json);
  }

  /**
   * Rotate the encryption key
   */
  async rotateEncryptionKey(newKey: string): Promise<void> {
    this.ensureInitialized();

    if (!this.encryptionKey) {
      throw new Error('Encryption is not enabled');
    }

    const newKeyBuffer = Buffer.from(newKey, 'hex');
    if (newKeyBuffer.length !== 32) {
      throw new Error('New encryption key must be 32 bytes (64 hex characters)');
    }

    // Get all secrets
    const keys = await this.listSecrets();

    // Re-encrypt all secrets with new key
    for (const key of keys) {
      const value = await this.getSecret(key);
      this.encryptionKey = newKeyBuffer;
      await this.setSecret(key, value);
    }

    // Save new key
    const keyPath = path.join(this.basePath, '.key');
    await fs.promises.writeFile(keyPath, newKey, { mode: 0o600 });
  }

  /**
   * Export secrets (encrypted backup)
   */
  async exportSecrets(): Promise<string> {
    this.ensureInitialized();

    const keys = await this.listSecrets();
    const exportData: Record<string, string> = {};

    for (const key of keys) {
      const filePath = this.resolvePath(key);
      exportData[key] = await fs.promises.readFile(filePath, 'utf-8');
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Import secrets from backup
   */
  async importSecrets(data: string, merge: boolean = true): Promise<void> {
    this.ensureInitialized();

    const importData = JSON.parse(data) as Record<string, string>;

    if (!merge) {
      // Clear existing secrets
      const keys = await this.listSecrets();
      for (const key of keys) {
        await this.deleteSecret(key);
      }
    }

    // Import new secrets
    for (const [key, value] of Object.entries(importData)) {
      const filePath = this.resolvePath(key);
      const dir = path.dirname(filePath);
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(filePath, value, { mode: 0o600 });
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(): AuditLogEntry[] {
    return [...this.auditLog];
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Shutdown the provider
   */
  async shutdown(): Promise<void> {
    // Clear encryption key from memory
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
    }
    this.initialized = false;
  }

  /**
   * Encrypt data
   */
  private encrypt(plaintext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    const payload: EncryptedPayload = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted,
      version: 1,
    };

    return JSON.stringify(payload);
  }

  /**
   * Decrypt data
   */
  private decrypt(ciphertext: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not set');
    }

    let payload: EncryptedPayload;
    try {
      payload = JSON.parse(ciphertext);
    } catch {
      // If not JSON, it's not encrypted or is plain text
      return ciphertext;
    }

    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Get or create encryption key
   */
  private async getOrCreateEncryptionKey(): Promise<Buffer> {
    const keyPath = path.join(this.basePath, '.key');

    try {
      const keyHex = await fs.promises.readFile(keyPath, 'utf-8');
      return Buffer.from(keyHex.trim(), 'hex');
    } catch {
      // Generate new key
      const newKey = crypto.randomBytes(32);
      await fs.promises.writeFile(keyPath, newKey.toString('hex'), { mode: 0o600 });
      return newKey;
    }
  }

  /**
   * Resolve a key to a file path
   */
  private resolvePath(key: string): string {
    // Normalize key to prevent path traversal
    const normalized = key.replace(/\.\./g, '').replace(/^\/+/, '');
    return path.join(this.basePath, normalized);
  }

  /**
   * Validate a key
   */
  private validateKey(key: string): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Key must be a non-empty string');
    }

    if (key.includes('..')) {
      throw new Error('Key cannot contain path traversal sequences');
    }

    if (key.startsWith('/')) {
      throw new Error('Key cannot start with a slash');
    }
  }

  /**
   * Log audit entry
   */
  private logAudit(action: AuditLogEntry['action'], key: string, success: boolean, error?: string): void {
    if (this.config.enableAuditLog !== false) {
      this.auditLog.push({
        timestamp: new Date(),
        action,
        key,
        success,
        error,
      });
    }
  }

  /**
   * Ensure provider is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Secrets provider not initialized. Call initialize() first.');
    }
  }
}

/**
 * Export provider instance for easy registration
 */
export function createFileSecretsProvider(config?: FileSecretsConfig): FileSecretsProvider {
  return new FileSecretsProvider(config);
}

/**
 * Default export
 */
export default FileSecretsProvider;