# @mycodexvantaos/namespaces-sdk

**Native MyCodexVantaOS Namespaces SDK - Machine-Native, Auditable Platform Integration Layer**

## Overview

This package provides a comprehensive SDK for building MyCodexVantaOS providers and services with built-in provider abstraction, lifecycle management, health checking, and observability. It strictly follows the [MyCodexVantaOS Naming Specification v1](./NAMING_SPEC_V1.md) and [Unified Architecture Specification](./UNIFIED_ARCHITECTURE_SPEC.md).

## Key Features

- **Provider Abstraction Layer**: 19 canonical capabilities (database, storage, auth, etc.)
- **Dynamic Provider Registry**: Automatic discovery, registration, and lifecycle management
- **Health Check System**: Built-in health monitoring for all providers
- **Auto Mode Detection**: Automatic detection of native, connected, or hybrid runtime modes
- **Schema Validation**: Integrated with [@mycodexvantaos/taxonomy-core](../mycodexvantaos-taxonomy-core/) for naming compliance
- **Observability Ready**: Built-in logging, tracing, and metrics support

## Installation

```bash
npm install @mycodexvantaos/namespaces-sdk
```

## Quick Start

### Creating a Custom Provider

```typescript
import { BaseProvider, HealthStatus } from '@mycodexvantaos/namespaces-sdk';

class MyDatabaseProvider implements BaseProvider {
  readonly capability = 'database';
  readonly source = 'native';
  readonly criticality = 'critical';
  readonly supportsModes = ['native', 'connected'];

  async initialize(config?: any): Promise<void> {
    // Initialize database connection
    console.log('Initializing database...');
  }

  async healthCheck(): Promise<{ status: HealthStatus }> {
    // Check database connection
    return { status: 'healthy' };
  }

  async query(sql: string, params?: any[]): Promise<any[]> {
    // Execute query
    return [];
  }
}
```

### Using the SDK

```typescript
import { createSDK } from '@mycodexvantaos/namespaces-sdk';

// Create and initialize SDK
const sdk = await createSDK({
  debug: true,
  mode: 'native'
});

// Register a provider
sdk.register(new MyDatabaseProvider(), 'my-database');

// Get a provider
const dbProvider = sdk.getProvider('my-database');

// Perform health check
const healthResults = await sdk.healthCheck();
healthResults.forEach((result, providerName) => {
  console.log(`${providerName}: ${result.status}`);
});

// Shutdown
await sdk.shutdown();
```

### Using Provider Registry

```typescript
import { ProviderRegistry } from '@mycodexvantaos/namespaces-sdk';

const registry = ProviderRegistry.getInstance();

// Register provider
registry.register(new MyDatabaseProvider(), 'my-database');

// Initialize provider
await registry.initialize('my-database');

// Get by capability
const dbProvider = registry.getByCapabilityFirst('database');

// Health check
const healthResult = await registry.healthCheck('my-database');
console.log(healthResult.status); // 'healthy'

// Get statistics
const stats = registry.getStats();
console.log(stats);
```

## Supported Capabilities

Following naming-spec-v1 §5.5, the SDK supports 19 canonical capabilities:

1. **database** - Relational and NoSQL databases
2. **storage** - Object storage and file systems
3. **auth** - Authentication and authorization
4. **queue** - Message queues and job queues
5. **state-store** - Distributed state management
6. **secrets** - Secret management
7. **repo** - Repository management
8. **deploy** - Deployment and CI/CD
9. **validation** - Schema validation
10. **security** - Security scanning and compliance
11. **observability** - Logging, tracing, and metrics
12. **notification** - Notification systems
13. **scheduler** - Job scheduling
14. **vector-store** - Vector similarity search
15. **embedding** - Text embeddings
16. **llm** - Large Language Models
17. **graph** - Graph databases
18. **cache** - Caching systems
19. **search** - Full-text search

## Provider Interfaces

### BaseProvider

All providers must implement the base interface:

```typescript
interface BaseProvider {
  readonly capability: ProviderCapability;
  readonly source: ProviderSource;
  readonly criticality: ProviderCriticality;
  readonly supportsModes: ResolvedMode[];
  
  initialize?(config?: unknown): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  shutdown?(): Promise<void>;
}
```

### Capability-Specific Interfaces

Each capability has a dedicated interface extending BaseProvider:

- **DatabaseProvider**: `query()`, `execute()`, `transaction()`
- **StorageProvider**: `put()`, `get()`, `delete()`, `exists()`, `list()`
- **AuthProvider**: `authenticate()`, `authorize()`, `generateToken()`, `validateToken()`
- **SecretsProvider**: `getSecret()`, `setSecret()`, `deleteSecret()`, `listSecrets()`
- **ObservabilityProvider**: `log()`, `metric()`, `trace()`
- **VectorStoreProvider**: `upsert()`, `query()`, `delete()`, `createCollection()`, `dropCollection()`
- **LLMProvider**: `chat()`, `streamChat()`, `embedding()`

## Runtime Modes

The SDK supports three runtime modes with automatic detection:

### Native Mode
- No external dependencies
- Built-in providers only
- Zero configuration

### Connected Mode
- Cloud-native providers (AWS, GCP, Azure)
- External services
- Configuration via environment variables

### Hybrid Mode
- Mix of native and connected providers
- Fallback capabilities
- Best of both worlds

## Naming Specification Compliance

This package enforces [MyCodexVantaOS Naming Specification v1](./NAMING_SPEC_V1.md):

### Provider Naming (§8.1)
```
<capability-id>-<provider-name>
```

Examples:
- `database-postgres`
- `vector-store-pgvector`
- `llm-openai`

### Package Naming (§7.1)
```
@mycodexvantaos/<package-short-id>
```

## Configuration

### Environment Variables

```bash
# SDK Mode
MYCODEXVANTAOS_MODE=native  # or connected, hybrid

# Debug Mode
MYCODEXVANTAOS_DEBUG=true

# Cloud Providers (for connected mode)
CLOUD_PROVIDER=aws
AWS_REGION=us-east-1
```

### SDK Configuration

```typescript
const config: SDKConfig = {
  debug: true,
  environment: 'development',
  mode: 'native',
  requiredProviders: [
    { capability: 'database' },
    { capability: 'secrets' }
  ],
  optionalProviders: [
    { capability: 'observability' }
  ]
};
```

## Health Checking

All providers implement health checks:

```typescript
const healthResult = await provider.healthCheck();
console.log(healthResult);
// {
//   status: 'healthy',
//   timestamp: 2024-04-19T00:00:00.000Z,
//   message: 'Connection successful',
//   details: { latency: 5 }
// }
```

Health statuses:
- **healthy**: Provider is functioning correctly
- **degraded**: Provider is operational but with limitations
- **unhealthy**: Provider is not functioning
- **unknown**: Health status cannot be determined

## Best Practices

### 1. Proper Initialization
Always initialize providers before use:

```typescript
await sdk.initialize(); // Initialize all providers
// or
await registry.initialize('provider-name'); // Initialize specific provider
```

### 2. Health Monitoring
Regularly perform health checks:

```typescript
const results = await sdk.healthCheck();
results.forEach((result, name) => {
  if (result.status !== 'healthy') {
    console.warn(`Provider ${name} is ${result.status}`);
  }
});
```

### 3. Proper Cleanup
Always shutdown when done:

```typescript
await sdk.shutdown();
```

### 4. Use Canonical Capabilities
Always use canonical capability IDs:

```typescript
// ✅ Correct
const db = registry.getByCapability('database');

// ❌ Wrong
const db = registry.getByCapability('postgres');
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