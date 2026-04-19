# CodexVanta OS — Core Kernel

**codexvanta-os-core-kernel** is the foundational layer of CodexVanta OS. It defines all 12 Provider interfaces, implements 12 Native Providers, provides the ProviderRegistry runtime capability detector, and establishes the architectural contracts that every other module depends on.

---

## Purpose

The Core Kernel is Tier 0 — the foundation upon which the entire platform stands. It answers the fundamental question: "How does the platform access capabilities without hardcoding dependencies?"

The answer: **Provider interfaces + ProviderRegistry + Native-first implementations.**

---

## Core Capabilities

### 12 Provider Interfaces
Abstract TypeScript interfaces that define the contract for each platform capability:

| # | Interface | Capability | Native Implementation |
|---|-----------|------------|----------------------|
| 1 | DatabaseProvider | Relational data persistence | SQLite (better-sqlite3) |
| 2 | StorageProvider | File/object storage | Local filesystem (fs) |
| 3 | AuthProvider | Authentication tokens | JWT with HMAC-SHA256 |
| 4 | QueueProvider | Message pub/sub | In-process EventEmitter |
| 5 | StateStoreProvider | Key-value state | In-memory Map |
| 6 | SecretsProvider | Secret management | Environment variables + .env files |
| 7 | RepoProvider | Repository operations | Local git CLI |
| 8 | DeployProvider | Deployment execution | Local process spawn |
| 9 | ValidationProvider | Schema validation | JSON Schema (ajv) |
| 10 | SecurityScannerProvider | Security scanning | Static pattern matching |
| 11 | ObservabilityProvider | Logging, metrics, tracing | Console + in-memory |
| 12 | NotificationProvider | Notifications | Console output |

### ProviderRegistry
The runtime capability detector that:
1. Registers all available providers (native + external)
2. Detects environment capabilities from env vars and connectivity
3. Selects the best provider per capability (external preferred if available)
4. Initializes selected providers
5. Runs health checks
6. Provides auto-fallback from external to native on failure

### 3 Operational Modes
- **Native** — All 12 native providers, zero external dependencies
- **Connected** — External providers for all capabilities
- **Hybrid** — Mix of native + external, auto-detected per capability

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│              Core Kernel (Tier 0)                 │
│                                                   │
│  ┌────────────────────────────────────────────┐   │
│  │         12 Provider Interfaces              │   │
│  │  database · storage · auth · queue          │   │
│  │  stateStore · secrets · repo · deploy       │   │
│  │  validation · security · observability      │   │
│  │  notification                               │   │
│  └────────────────────────────────────────────┘   │
│                                                   │
│  ┌──────────────────┐  ┌──────────────────────┐   │
│  │  Native Providers │  │ External Providers   │   │
│  │  (12 built-in)    │  │ (3 examples)         │   │
│  └────────┬─────────┘  └─────────┬────────────┘   │
│           │                       │                │
│  ┌────────┴───────────────────────┴────────────┐   │
│  │           ProviderRegistry                   │   │
│  │  registerNative() · registerExternal()       │   │
│  │  initialize() · resolve<T>() · shutdown()    │   │
│  │  healthcheckAll() · getMode()                │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
codexvanta-os-core-kernel/
├── REPO_MANIFEST.yaml
├── README.md
├── ARCHITECTURE.md
├── LICENSE
├── .gitignore
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── index.ts                    # Barrel exports + bootstrapKernel()
│   ├── interfaces/
│   │   ├── index.ts
│   │   ├── database.ts
│   │   ├── storage.ts
│   │   ├── auth.ts
│   │   ├── queue.ts
│   │   ├── state-store.ts
│   │   ├── secrets.ts
│   │   ├── repo.ts
│   │   ├── deploy.ts
│   │   ├── validation.ts
│   │   ├── security.ts
│   │   ├── observability.ts
│   │   └── notification.ts
│   └── providers/
│       ├── registry.ts              # ProviderRegistry
│       ├── native/
│       │   ├── index.ts
│       │   ├── database.ts          # SQLite
│       │   ├── storage.ts           # Filesystem
│       │   ├── auth.ts              # JWT/HMAC
│       │   ├── queue.ts             # EventEmitter
│       │   ├── state-store.ts       # Map
│       │   ├── secrets.ts           # env + .env
│       │   ├── repo.ts              # git CLI
│       │   ├── deploy.ts            # local spawn
│       │   ├── validation.ts        # JSON Schema
│       │   ├── security.ts          # pattern match
│       │   ├── observability.ts     # console
│       │   └── notification.ts      # console
│       └── external/
│           ├── index.ts
│           ├── database.ts          # PostgreSQL example
│           ├── state-store.ts       # Redis example
│           └── storage.ts           # S3 example
└── tests/
```

---

## Tier

**Tier 0** — No dependencies. All other 24 repos depend on core-kernel.

---

## Philosophy

> 「第三方服務是平台的擴充出口，不是平台成立的地基。」
>
> The Core Kernel ensures the platform stands on its own two feet.
> Every capability works natively before any external provider is introduced.

---

## License

MIT — see LICENSE
