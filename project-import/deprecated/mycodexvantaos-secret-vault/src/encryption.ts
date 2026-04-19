/**
 * CodexvantaOS — secret-vault / EncryptionService
 * Encryption utilities using Node.js crypto
 */

import * as crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

export class EncryptionService {
  private masterKey: Buffer;

  constructor(masterKeyHex?: string) {
    this.masterKey = masterKeyHex
      ? Buffer.from(masterKeyHex, "hex")
      : crypto.randomBytes(KEY_LENGTH);
  }

  getMasterKeyHex(): string {
    return this.masterKey.toString("hex");
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.masterKey, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
  }

  decrypt(encryptedData: string): string {
    const parts = encryptedData.split(":");
    if (parts.length !== 3) throw new Error("Invalid encrypted data format");
    const iv = Buffer.from(parts[0], "hex");
    const tag = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(parts[2], "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  hash(data: string, algorithm = "sha256"): string {
    return crypto.createHash(algorithm).update(data).digest("hex");
  }

  generateToken(length = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  deriveKey(password: string, salt?: string): { key: string; salt: string } {
    const actualSalt = salt ?? crypto.randomBytes(16).toString("hex");
    const key = crypto.pbkdf2Sync(password, actualSalt, 100000, KEY_LENGTH, "sha512");
    return { key: key.toString("hex"), salt: actualSalt };
  }
}