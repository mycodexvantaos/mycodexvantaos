# CodexVanta OS — Core Kernel Architecture

## Overview

The Core Kernel is the architectural foundation of CodexVanta OS. It defines the provider-agnostic contract system, implements native fallbacks for all 12 capabilities, and provides the runtime registry that wires providers into the service layer.

---

## Design Principles

1. **Interface-first design** — Every capability is defined as a TypeScript interface before any implementation exists. Services depend on interfaces, never on implementations.

2. **Native completeness** — The kernel ships with 12 native providers that together form a complete, functional platform. No external service is required for any capability.

3. **Registry-mediated access** — Services never instantiate providers directly. They request capabilities from ProviderRegistry, which resolves the best available implementation.

4. **Graceful degradation** — If an external provider fails its health check, ProviderRegistry automatically falls back to the native implementation and logs the fallback event.

5. **Mode detection** — The registry detects the operational mode (native/connected/hybrid) by probing environment variables and connectivity at startup.

---

## ProviderRegistry Lifecycle

```
1. Register Phase
   ├─ registerNative(capability, NativeProvider)    × 12
   └─ registerExternal(capability, ExternalProvider) × N

2. Initialize Phase
   ├─ Detect environment (env vars, connectivity)
   ├─ Select provider per capability:
   │   ├─ If external registered + env configured → use external
   │   ├─ If external fails healthcheck → fallback to native
   │   └─ Otherwise → use native
   └─ Initialize all selected providers

3. Runtime Phase
   ├─ resolve<T>(capability) → returns active provider
   ├─ healthcheckAll() → returns health status map
   └─ getMode() → returns 'native' | 'connected' | 'hybrid'

4. Shutdown Phase
   └─ shutdown() → gracefully close all providers
```

---

## Provider Interface Contract

Every provider interface follows this pattern:

```typescript
export interface XxxProvider {
  // Core operations
  method1(args): Promise<Result>;
  method2(args): Promise<Result>;
  
  // Lifecycle
  healthcheck(): Promise<HealthStatus>;
}
```

Key rules:
- All methods are async (return Promise)
- All methods accept typed arguments
- All providers have a healthcheck() method
- No provider method throws — errors are returned as typed results

---

## Native Provider Implementations

| Provider | Technology | Data Persistence | Limitations |
|----------|-----------|-----------------|-------------|
| Database | better-sqlite3 | File-based SQLite | Single-writer, no replication |
| Storage | Node.js fs | Local filesystem | Single machine |
| Auth | crypto (HMAC) | In-memory + DB | No OAuth flows |
| Queue | EventEmitter | In-memory | No persistence, single process |
| StateStore | Map | In-memory | Lost on restart |
| Secrets | process.env + dotenv | .env files | No rotation UI |
| Repo | child_process (git) | Local git repos | Requires git installed |
| Deploy | child_process | Local processes | No container orchestration |
| Validation | ajv | In-memory schemas | No schema registry |
| Security | RegExp patterns | Static rules | No CVE database |
| Observability | console | stdout/stderr | No aggregation |
| Notification | console | stdout | No delivery channels |

---

## External Provider Examples

The kernel includes 3 external provider examples as reference implementations:

1. **PostgreSQL DatabaseProvider** — Demonstrates connection pooling, migrations, transactions
2. **Redis StateStoreProvider** — Demonstrates TTL, increment, pub/sub
3. **S3 StorageProvider** — Demonstrates bucket operations, presigned URLs

---

## Dependencies

- **Tier 0** — The root of the dependency graph
- No repo dependencies
- All 24 other repos depend on core-kernel
- Provides: all 12 Provider interfaces, all 12 Native providers, ProviderRegistry
