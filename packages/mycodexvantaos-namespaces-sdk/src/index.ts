/**
 * MyCodexVantaOS Namespaces SDK
 * 
 * Native MyCodexVantaOS namespaces SDK - Machine-native, auditable platform integration layer
 * 
 * This package provides:
 * - Provider abstraction layer with 19 canonical capabilities
 * - Dynamic provider registry and lifecycle management
 * - Health check and observability integration
 * - Auto-detection of runtime modes (native, connected, hybrid)
 * - Schema validation through @mycodexvantaos/taxonomy-core
 * 
 * @package @mycodexvantaos/namespaces-sdk
 * @version 1.0.0
 */

export * from './types';
export * from './registry';
export * from './sdk';

// Re-export for convenience
export { createSDK } from './sdk';
export { ProviderRegistry } from './registry';