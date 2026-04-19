/**
 * Merkle Root Calculator - Provider Pattern Version
 * Transformed for platform independence
 */

import type { StorageCapability } from '../packages/capabilities/src/storage';
import type { LoggingCapability } from '../packages/capabilities/src/logging';
import * as crypto from 'crypto';

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  data?: string;
}

export interface MerkleRootResult {
  root: string;
  leafCount: number;
  treeHeight: number;
  leaves: string[];
  generatedAt: string;
}

/**
 * Merkle Root Calculator using Provider Pattern
 */
export class MerkleRootCalculator {
  private storage: StorageCapability | null = null;
  private logger: LoggingCapability | null = null;
  private initialized = false;

  constructor(private providerFactory: any) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.storage = await this.providerFactory.getStorageProvider();
      this.logger = await this.providerFactory.getLoggingProvider();

      await this.storage.initialize();
      await this.logger.initialize();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize MerkleRootCalculator:', error);
      throw error;
    }
  }

  /**
   * Calculate SHA-256 hash
   */
  private hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Calculate Merkle root from leaves
   */
  calculateRoot(leaves: string[]): MerkleRootResult {
    if (leaves.length === 0) {
      return {
        root: this.hash(''),
        leafCount: 0,
        treeHeight: 0,
        leaves: [],
        generatedAt: new Date().toISOString(),
      };
    }

    // Hash all leaves
    const hashedLeaves = leaves.map(l => this.hash(l));
    
    // Build tree
    let currentLevel = [...hashedLeaves];
    let height = 1;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = currentLevel[i + 1] || currentLevel[i]; // Duplicate last if odd
        const combined = this.hash(left + right);
        nextLevel.push(combined);
      }
      
      currentLevel = nextLevel;
      height++;
    }

    return {
      root: currentLevel[0],
      leafCount: leaves.length,
      treeHeight: height,
      leaves: hashedLeaves,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Build Merkle root from files in a directory
   */
  async buildFromDirectory(directory: string): Promise<MerkleRootResult> {
    this.ensureInitialized();

    await this.log('info', `Building Merkle root from: ${directory}`);

    const keys = await this.storage!.keys();
    const filesInDir = keys.filter(k => k.startsWith(directory)).sort();

    const leaves: string[] = [];

    for (const filePath of filesInDir) {
      const item = await this.storage!.get(filePath);
      if (item && item.value) {
        const content = typeof item.value === 'string' ? item.value : JSON.stringify(item.value);
        leaves.push(content);
      }
    }

    const result = this.calculateRoot(leaves);

    await this.log('info', `Merkle root calculated`, {
      root: result.root,
      leafCount: result.leafCount,
    });

    return result;
  }

  /**
   * Save Merkle root to storage
   */
  async saveResult(result: MerkleRootResult, outputPath: string): Promise<void> {
    this.ensureInitialized();

    await this.storage!.set(outputPath, JSON.stringify(result, null, 2), {
      tags: ['merkle', 'root'],
    });

    await this.log('info', `Merkle root saved to: ${outputPath}`);
  }

  /**
   * Verify a leaf exists in the tree
   */
  verifyLeaf(leaf: string, root: string, proof: string[]): boolean {
    let currentHash = this.hash(leaf);

    for (const sibling of proof) {
      currentHash = this.hash(
        currentHash < sibling ? currentHash + sibling : sibling + currentHash
      );
    }

    return currentHash === root;
  }

  async healthCheck(): Promise<boolean> {
    if (!this.storage || !this.logger) return false;
    try {
      const [s, l] = await Promise.all([
        this.storage.healthCheck(),
        this.logger.healthCheck(),
      ]);
      return s.healthy && l.healthy;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    if (this.storage) await this.storage.shutdown();
    if (this.logger) await this.logger.shutdown();
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.storage) {
      throw new Error('MerkleRootCalculator not initialized.');
    }
  }

  private async log(level: string, message: string, context?: any): Promise<void> {
    if (this.logger) {
      await this.logger.log({ level: level as any, message, context });
    }
  }
}

export async function createMerkleRootCalculator(providerFactory: any): Promise<MerkleRootCalculator> {
  const calc = new MerkleRootCalculator(providerFactory);
  await calc.initialize();
  return calc;
}