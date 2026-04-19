/**
 * CodexvantaOS — secret-vault / EncryptionService
 * Encryption utilities for data at rest and in transit
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import * as crypto from 'crypto';
import type * as T from '../types/index.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

export class EncryptionService {
  private masterKey: Buffer | null = null;
  private get providers() { return getProviders(); }

  async initialize(): Promise<void> {
    const masterKeyStr = await this.providers.secrets.get('MASTER_ENCRYPTION_KEY', 'global');
    if (masterKeyStr) {
      this.masterKey = Buffer.from(masterKeyStr.value, 'hex');
    } else {
      this.masterKey = crypto.randomBytes(KEY_LENGTH);
      await this.providers.secrets.set('MASTER_ENCRYPTION_KEY', this.masterKey.toString('hex'), { scope: 'global', tags: { purpose: 'master-encryption' } });
      this.providers.observability.info('Master encryption key generated');
    }
  }

  encrypt(plaintext: string): string {
    if (!this.masterKey) throw new Error('Encryption service not initialized');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    if (!this.masterKey) throw new Error('Encryption service not initialized');
    const parts = encryptedData.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted data format');
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(parts[2], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  hash(data: string, algorithm: string = 'sha256'): string { return crypto.createHash(algorithm).update(data).digest('hex'); }
  generateToken(length: number = 32): string { return crypto.randomBytes(length).toString('hex'); }

  deriveKey(password: string, salt?: string): { key: string; salt: string } {
    const actualSalt = salt ?? crypto.randomBytes(16).toString('hex');
    const key = crypto.pbkdf2Sync(password, actualSalt, 100000, KEY_LENGTH, 'sha512');
    return { key: key.toString('hex'), salt: actualSalt };
  }
}
