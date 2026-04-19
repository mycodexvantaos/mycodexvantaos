# CodexVanta OS — Config Manager Architecture

## Overview

The Config Manager provides hierarchical configuration resolution and feature flag management for CodexVanta OS. It implements a scope-chain resolution pattern where configuration values cascade from specific to general scopes.

---

## Design Principles

1. **Scope-chain resolution** — Configuration lookups traverse a scope chain: environment-specific → service-specific → global. The first match wins.

2. **Cache-first reads** — All configuration values are cached in StateStoreProvider. Cache invalidation occurs on write. This enables high-frequency reads without database pressure.

3. **Feature flags as first-class** — Feature flags are not bolted-on. They are a core configuration primitive with evaluation semantics, rollout percentages, and scoped overrides.

4. **Immutable history** — Configuration changes are logged. The current value is always queryable, and the change history is preserved for audit.

---

## Data Model

### Configuration Entry
```
{
  key: string
  value: any (JSON-serializable)
  scope: string (service name or "global")
  description: string
  updatedAt: Date
}
```

### Feature Flag
```
{
  key: string
  enabled: boolean
  rolloutPercentage: number (0-100)
  description: string
  overrides: Record<string, boolean> (scope → value)
  updatedAt: Date
}
```

---

## Resolution Algorithm

```
resolve(key, scope):
  1. cache = stateStore.get(`config:${scope}:${key}`)
  2. if cache hit → return cached
  3. db_scope = database.query(key, scope)
  4. if found → cache + return
  5. db_global = database.query(key, "global")
  6. if found → cache + return
  7. return undefined
```

---

## Provider Usage Map

| Service | database | stateStore | observability |
|---------|----------|------------|---------------|
| ConfigService | CRUD | cache | log changes |
| FeatureFlagService | CRUD | eval cache | log evaluations |

---

## Dependencies

- **Tier 1** in the CodexVanta OS dependency hierarchy
- Depends on: core-kernel
- Consumed by: cli, network-mesh, and all services needing configuration
