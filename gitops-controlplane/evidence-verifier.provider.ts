/**
 * Evidence Verifier - Provider Pattern Version
 * Transformed to use StorageCapability and ValidationCapability for platform independence
 * 
 * Supports:
 * - Native: Local file system verification (no external dependencies)
 * - Hybrid: Remote evidence with fallback to local
 * - Connected: Remote evidence store only
 */

import type { StorageCapability } from '../packages/capabilities/src/storage';
import type { ValidationCapability, ValidationResult } from '../packages/capabilities/src/validation';
import type { LoggingCapability } from '../packages/capabilities/src/logging';

export interface EvidenceFile {
  name: string;
  path: string;
  exists: boolean;
  validJson: boolean;
  error?: string;
  content?: any;
}

export interface VerificationReport {
  generatedAt: string;
  evidenceDir: string;
  dirExists: boolean;
  totalRequired: number;
  found: number;
  missing: number;
  validJson: number;
  invalidJson: number;
  valid: boolean;
  files: EvidenceFile[];
}

const REQUIRED_EVIDENCE_FILES = [
  'schema-report.json',
  'vector-report.json',
  'digests.json',
  'merkle-root.json',
  'repo-fingerprint.json',
  'toolchain.json',
  'gate-report.json'
];

/**
 * Evidence Verifier using Provider Pattern
 */
export class EvidenceVerifier {
  private storage: StorageCapability | null = null;
  private validation: ValidationCapability | null = null;
  private logger: LoggingCapability | null = null;
  private initialized = false;

  constructor(
    private providerFactory: any,
    private requiredFiles: string[] = REQUIRED_EVIDENCE_FILES
  ) {}

  /**
   * Initialize the verifier
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.storage = await this.providerFactory.getStorageProvider();
      this.validation = await this.providerFactory.getValidationProvider();
      this.logger = await this.providerFactory.getLoggingProvider();

      await Promise.all([
        this.storage.initialize(),
        this.validation?.initialize(),
        this.logger.initialize(),
      ]);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize EvidenceVerifier:', error);
      throw error;
    }
  }

  /**
   * Verify JSON file
   */
  private async verifyJsonFile(path: string): Promise<{ valid: boolean; error?: string; content?: any }> {
    try {
      const item = await this.storage!.get(path);
      
      if (!item || !item.value) {
        return { valid: false, error: 'File not found' };
      }

      try {
        const content = typeof item.value === 'string' 
          ? JSON.parse(item.value)
          : item.value;
        
        return { valid: true, content };
      } catch (e: any) {
        return { valid: false, error: `Invalid JSON: ${e.message}` };
      }
    } catch (error: any) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Verify evidence files
   */
  async verify(evidenceDir: string = 'dist/evidence'): Promise<VerificationReport> {
    this.ensureInitialized();

    await this.log('info', `Starting evidence verification in: ${evidenceDir}`);

    const report: VerificationReport = {
      generatedAt: new Date().toISOString(),
      evidenceDir,
      dirExists: false,
      totalRequired: this.requiredFiles.length,
      found: 0,
      missing: 0,
      validJson: 0,
      invalidJson: 0,
      valid: false,
      files: [],
    };

    // Check if directory exists
    try {
      const keys = await this.storage!.keys();
      report.dirExists = keys.some(k => k.startsWith(evidenceDir));
    } catch (error: any) {
      await this.log('error', `Failed to check directory: ${error.message}`);
      report.files.push({
        name: evidenceDir,
        path: evidenceDir,
        exists: false,
        validJson: false,
        error: 'Evidence directory does not exist',
      });
      return report;
    }

    // Verify each required file
    for (const filename of this.requiredFiles) {
      const filePath = `${evidenceDir}/${filename}`;
      
      const fileResult: EvidenceFile = {
        name: filename,
        path: filePath,
        exists: false,
        validJson: false,
      };

      const verification = await this.verifyJsonFile(filePath);
      
      fileResult.exists = verification.valid || verification.error !== 'File not found';
      fileResult.validJson = verification.valid;
      fileResult.error = verification.error;
      fileResult.content = verification.content;

      if (fileResult.exists) {
        report.found++;
        if (fileResult.validJson) {
          report.validJson++;
        } else {
          report.invalidJson++;
        }
      } else {
        report.missing++;
      }

      report.files.push(fileResult);
    }

    // Calculate overall validity
    report.valid = (
      report.missing === 0 &&
      report.invalidJson === 0 &&
      report.dirExists
    );

    await this.log('info', `Evidence verification ${report.valid ? 'PASSED' : 'FAILED'}`, {
      found: report.found,
      missing: report.missing,
      invalid: report.invalidJson,
    });

    return report;
  }

  /**
   * Save verification report
   */
  async saveReport(report: VerificationReport, outputPath: string): Promise<void> {
    this.ensureInitialized();

    await this.storage!.set(outputPath, JSON.stringify(report, null, 2), {
      tags: ['verification', 'report'],
    });

    await this.log('info', `Verification report saved to: ${outputPath}`);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.storage || !this.logger) return false;

    try {
      const [storageHealth, loggerHealth] = await Promise.all([
        this.storage.healthCheck(),
        this.logger.healthCheck(),
      ]);

      return storageHealth.healthy && loggerHealth.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.storage) await this.storage.shutdown();
    if (this.validation) await this.validation.shutdown();
    if (this.logger) await this.logger.shutdown();
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.storage) {
      throw new Error('EvidenceVerifier not initialized. Call initialize() first.');
    }
  }

  private async log(level: string, message: string, context?: any): Promise<void> {
    if (this.logger) {
      await this.logger.log({ level: level as any, message, context });
    } else {
      console.log(`[${level}] ${message}`, context || '');
    }
  }
}

/**
 * Factory function to create EvidenceVerifier instance
 */
export async function createEvidenceVerifier(
  providerFactory: any,
  requiredFiles?: string[]
): Promise<EvidenceVerifier> {
  const verifier = new EvidenceVerifier(providerFactory, requiredFiles);
  await verifier.initialize();
  return verifier;
}