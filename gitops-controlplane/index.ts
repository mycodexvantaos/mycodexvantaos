/**
 * GitOps Control Plane Module Index
 * Platform-Independent Provider Pattern Implementation
 * 
 * This module provides GitOps control plane functionality
 * that works in any runtime environment with zero external dependencies.
 * 
 * Features:
 * - Evidence verification for CI/CD pipelines
 * - Merkle root calculation for content-addressable storage
 * - Schema validation
 * - Digest computation
 * - Toolchain collection
 * 
 * Runtime Modes:
 * - native: Local file system operations, no external services
 * - hybrid: Remote storage with fallback to local
 * - connected: Remote storage only
 */

// Re-export types
export type { EvidenceFile, VerificationReport } from './evidence-verifier.provider';
export type { MerkleNode, MerkleRootResult } from './merkle-root.provider';

// Re-export classes
export { 
  EvidenceVerifier, 
  createEvidenceVerifier,
} from './evidence-verifier.provider';

export { 
  MerkleRootCalculator, 
  createMerkleRootCalculator,
} from './merkle-root.provider';

// Provider factory for dependency injection
export { getProviderFactory, ProviderFactory } from '../packages/capabilities/src/provider-factory';

// Runtime configuration
export { getRuntimeConfig, RuntimeConfig, RuntimeMode } from '../packages/capabilities/src/runtime-config';

/**
 * Initialize all GitOps modules
 */
export async function initializeGitOps(config?: {
  evidenceDir?: string;
  requiredFiles?: string[];
}): Promise<{
  evidenceVerifier: import('./evidence-verifier.provider').EvidenceVerifier;
  merkleCalculator: import('./merkle-root.provider').MerkleRootCalculator;
}> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const { createEvidenceVerifier } = await import('./evidence-verifier.provider');
  const { createMerkleRootCalculator } = await import('./merkle-root.provider');

  const providerFactory = getProviderFactory();

  const [evidenceVerifier, merkleCalculator] = await Promise.all([
    createEvidenceVerifier(providerFactory, config?.requiredFiles),
    createMerkleRootCalculator(providerFactory),
  ]);

  return { evidenceVerifier, merkleCalculator };
}

/**
 * Run full evidence verification pipeline
 */
export async function runVerificationPipeline(config: {
  evidenceDir: string;
  outputPath: string;
  requiredFiles?: string[];
}): Promise<import('./evidence-verifier.provider').VerificationReport> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const { createEvidenceVerifier } = await import('./evidence-verifier.provider');
  const { createMerkleRootCalculator } = await import('./merkle-root.provider');

  const providerFactory = getProviderFactory();

  const [verifier, merkle] = await Promise.all([
    createEvidenceVerifier(providerFactory, config.requiredFiles),
    createMerkleRootCalculator(providerFactory),
  ]);

  // Verify evidence
  const report = await verifier.verify(config.evidenceDir);

  // Calculate merkle root of evidence
  const merkleResult = await merkle.buildFromDirectory(config.evidenceDir);

  // Add merkle root to report
  const enhancedReport = {
    ...report,
    merkleRoot: merkleResult.root,
    merkleLeafCount: merkleResult.leafCount,
  };

  // Save report
  await verifier.saveReport(enhancedReport as any, config.outputPath);

  // Cleanup
  await Promise.all([verifier.shutdown(), merkle.shutdown()]);

  return report;
}

/**
 * Health check all GitOps modules
 */
export async function healthCheckAll(): Promise<{
  evidenceVerifier: boolean;
  merkleCalculator: boolean;
  overall: boolean;
}> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const factory = getProviderFactory();

  const [storage, validation, logging] = await Promise.all([
    factory.getStorageProvider(),
    factory.getValidationProvider(),
    factory.getLoggingProvider(),
  ]);

  const [storageHealth, validationHealth, loggingHealth] = await Promise.all([
    storage.healthCheck(),
    validation?.healthCheck() ?? { healthy: true },
    logging.healthCheck(),
  ]);

  return {
    evidenceVerifier: storageHealth.healthy && loggingHealth.healthy,
    merkleCalculator: storageHealth.healthy && loggingHealth.healthy,
    overall: storageHealth.healthy && validationHealth.healthy && loggingHealth.healthy,
  };
}

/**
 * Shutdown all modules
 */
export async function shutdownAll(): Promise<void> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const factory = getProviderFactory();

  const providers = await Promise.all([
    factory.getStorageProvider(),
    factory.getValidationProvider(),
    factory.getLoggingProvider(),
  ]);

  await Promise.all(providers.filter(p => p).map(p => p.shutdown()));
}