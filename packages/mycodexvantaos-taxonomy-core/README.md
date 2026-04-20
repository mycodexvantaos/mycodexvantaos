# @mycodexvantaos/taxonomy-core

**Native MyCodexVantaOS Taxonomy System following naming-spec-v1**

## Overview

This package provides comprehensive taxonomy and naming capabilities for the MyCodexVantaOS platform, strictly adhering to the [MyCodexVantaOS Naming Specification v1](./NAMING_SPEC_V1.md).

## Key Features

- **Canonical Identifier Validation**: Validate service IDs, package short IDs, module IDs, provider instances, and capability IDs against naming-spec-v1
- **Bidirectional Mapping**: Convert between different naming formats (service ID, package name, K8s resource, etc.)
- **Composite Identifier Support**: Generate and parse composite identifiers with `--` separator
- **Protocol-Specific Formats**: Generate package names, environment variables, OCI image references, URIs, URNs
- **Compliance Checking**: Batch validation and compliance scoring

## Installation

```bash
npm install @mycodexvantaos/taxonomy-core
```

## Quick Start

### Validation

```typescript
import { MyCodexVantaOSValidator } from '@mycodexvantaos/taxonomy-core';

// Validate service ID
const result = MyCodexVantaOSValidator.validateServiceId('mycodexvantaos-core-kernel');

if (result.valid) {
  console.log('✅ Service ID is valid');
} else {
  console.log('❌ Violations:', result.violations);
}

// Validate provider instance
const providerResult = MyCodexVantaOSValidator.validateProviderInstanceId('database-postgres');
console.log('Provider valid:', providerResult.valid);

// Batch validation
const compliance = MyCodexVantaOSValidator.checkCompliance([
  { id: 'mycodexvantaos-core-kernel', type: 'service-id' },
  { id: 'database-postgres', type: 'provider-instance' },
  { id: 'vector-store', type: 'capability-id' }
]);

console.log(`Compliance score: ${compliance.score}%`);
```

### Mapping

```typescript
import { MyCodexVantaOSMapper } from '@mycodexvantaos/taxonomy-core';

// Convert service ID to package name
const packageName = MyCodexVantaOSMapper.serviceIdToPackageName('mycodexvantaos-core-kernel');
console.log(packageName); // @mycodexvantaos/core-kernel

// Extract components
const parsed = MyCodexVantaOSMapper.parseServiceId('mycodexvantaos-ai-embedding');
console.log(parsed);
// {
//   organization: 'mycodexvantaos',
//   domain: 'ai',
//   capability: 'embedding',
//   packageShortId: 'ai-embedding',
//   packageName: '@mycodexvantaos/ai-embedding',
//   k8sResourceName: 'mycodexvantaos-ai-embedding'
// }

// Generate environment variable
const envVar = MyCodexVantaOSMapper.toEnvVar('mycodexvantaos-database-postgres', 'url');
console.log(envVar); // MYCODEXVANTAOS_MYCODEXVANTAOS_DATABASE_POSTGRES_URL

// Generate OCI image reference
const ociRef = MyCodexVantaOSMapper.toOciImageReference(
  'ghcr.io',
  'mycodexvantaos-core-kernel',
  'v1.0.0'
);
console.log(ociRef); // ghcr.io/mycodexvantaos/mycodexvantaos-core-kernel:v1.0.0
```

### Composite Identifiers

```typescript
import { MyCodexVantaOSMapper } from '@mycodexvantaos/taxonomy-core';

// Generate vector collection ID (§9.2)
const vectorCollectionId = MyCodexVantaOSMapper.toVectorCollectionId(
  'mycodexvantaos-ai-memory',
  'memories',
  'openai--text-embedding-3-small--1536d'
);
console.log(vectorCollectionId);
// mycodexvantaos-ai-memory--memories--openai--text-embedding-3-small--1536d

// Generate embedding model alias (§9.3)
const modelAlias = MyCodexVantaOSMapper.toEmbeddingModelAlias('openai', 'text-embedding-3-small', 1536);
console.log(modelAlias); // openai--text-embedding-3-small--1536d

// Generate retrieval pipeline ID (§9.4)
const pipelineId = MyCodexVantaOSMapper.toRetrievalPipelineId('dense', 'pgvector');
console.log(pipelineId); // retrieval--dense--pgvector

// Generate search index ID (§9.5)
const searchIndexId = MyCodexVantaOSMapper.toSearchIndexId(
  'mycodexvantaos-docs-search',
  'content',
  'cjk'
);
console.log(searchIndexId); // idx--mycodexvantaos-docs-search--content--cjk

// Generate graph node ID (§9.6)
const graphNodeId = MyCodexVantaOSMapper.toGraphNodeId(
  'mycodexvantaos-core-kernel',
  'user',
  'alice'
);
console.log(graphNodeId); // mycodexvantaos-core-kernel--user--alice

// Generate timestamped ID (§9.8)
const timestampedId = MyCodexVantaOSMapper.toTimestampedId('job');
console.log(timestampedId); // job--20260418--a1b2c3

// Generate content-addressed ID (§9.9)
const contentAddressedId = MyCodexVantaOSMapper.toContentAddressedId(
  'dataset',
  '3f4a8b9c1d2e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1'
);
console.log(contentAddressedId); // dataset--sha256-3f4a8b9c1d2e

// Generate graph namespace IRI (§10.1)
const graphIri = MyCodexVantaOSMapper.toGraphNamespaceIri('core', 'Service');
console.log(graphIri); // https://mycodexvantaos.org/ns/core#Service
```

## Naming Specification Compliance

This package enforces [MyCodexVantaOS Naming Specification v1](./NAMING_SPEC_V1.md):

### §3 Root Naming Principles
- **§3.1**: Allowed characters (a-z, 0-9, -)
- **§3.2**: Lowercase only
- **§3.3**: Separator rules (single `-` for canonical, `--` for composite)
- **§3.6**: No version in canonical names
- **§3.7**: No environment in canonical names
- **§3.8**: Length limits (max 253 chars)

### §5 Canonical Identifier Specifications
- **§5.1**: Service ID format (`mycodexvantaos-<domain>-<capability>`)
- **§5.2**: Package short ID format (`<domain>-<capability>`)
- **§5.3**: Module ID equals Service ID
- **§5.5**: Canonical capability set (19 capabilities)

### §7 Protocol-Specific Identifier Specifications
- **§7.1**: Package name format (`@mycodexvantaos/<package-short-id>`)
- **§7.2**: Environment variable format (`MYCODEXVANTAOS_<SUBSYSTEM>_<KEY>`)
- **§7.3**: OCI image reference format
- **§7.4**: Internal URI format
- **§7.5**: URN format

### §8 Provider and Capability Naming
- **§8.1**: Provider instance format (`<capability-id>-<provider-name>`)

### §9 Composite Identifier Specifications
- **§9.1**: Composite separator `--`
- **§9.2**: Vector collection format
- **§9.3**: Embedding model alias format
- **§9.4**: Retrieval pipeline ID format
- **§9.5**: Search index ID format
- **§9.6**: Graph node ID format
- **§9.8**: Timestamped ID format
- **§9.9**: Content-addressed ID format
- **§9.10**: UUID-based ID format

### §10 Knowledge Graph Naming
- **§10.1**: Namespace IRI format
- **§10.3**: Graph database index ID format

## API Reference

### MyCodexVantaOSValidator

```typescript
class MyCodexVantaOSValidator {
  static validateServiceId(id: string): ValidationResult;
  static validatePackageShortId(id: string): ValidationResult;
  static validateModuleId(id: string): ValidationResult;
  static validateCapabilityId(id: string): ValidationResult;
  static validateProviderInstanceId(id: string): ValidationResult;
  static validate(identifier: string, type: IdentifierType, context?: NamingContext): ValidationResult;
  static validateMany(identifiers: Array<{ id: string; type: IdentifierType }>): ValidationResult[];
  static checkCompliance(identifiers: Array<{ id: string; type: IdentifierType }>): ComplianceResult;
}
```

### MyCodexVantaOSMapper

```typescript
class MyCodexVantaOSMapper {
  static serviceIdToPackageShortId(serviceId: ServiceId): PackageShortId;
  static packageShortIdToServiceId(packageShortId: PackageShortId): ServiceId;
  static serviceIdToPackageName(serviceId: ServiceId): string;
  static packageNameToServiceId(packageName: string): ServiceId;
  static extractDomain(serviceId: ServiceId): string;
  static extractCapability(serviceId: ServiceId): string;
  static parseServiceId(serviceId: ServiceId): ParsedServiceId;
  static toEnvVar(serviceId: ServiceId, key: string): string;
  static toOciImageReference(registry: string, serviceId: ServiceId, tag: string): string;
  static toInternalUri(namespace: string, resourceType: string, resourceIdentifier: string): string;
  static toUrn(type: string, subtype: string, identifier: string): string;
  static toCompositeId(...segments: string[]): string;
  static parseCompositeId(compositeId: string): string[];
  static toVectorCollectionId(serviceId: ServiceId, purpose: string, embeddingModelAlias: string): string;
  static toEmbeddingModelAlias(provider: string, modelName: string, dimension: number): string;
  static toRetrievalPipelineId(strategy: string, storeType: string): string;
  static toSearchIndexId(serviceId: ServiceId, field: string, analyzer: string): string;
  static toGraphNodeId(serviceId: ServiceId, entityType: string, naturalKey: string): string;
  static toTimestampedId(prefix: string, date?: Date): string;
  static toContentAddressedId(prefix: string, hash: string): string;
  static toUuidBasedId(prefix: string, uuid: string): string;
  static toGraphNamespaceIri(domain: string, term: string): string;
  static toGraphIndexId(serviceId: ServiceId, label: string, property: string): string;
}
```

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- Documentation: [MyCodexVantaOS Naming Specification v1](./NAMING_SPEC_V1.md)
- Issues: [GitHub Issues](https://github.com/mycodexvantaos/mycodexvantaos/issues)
- Repository: [Git Repository](https://github.com/mycodexvantaos/mycodexvantaos)

---

**Version**: 1.0.0  
**Maintainer**: MyCodexVantaOS Team  
**Package Scope**: @mycodexvantaos