# CodexVanta OS — Config Manager

**codexvanta-os-config-manager** is the configuration and feature flag management service of CodexVanta OS. It provides hierarchical configuration resolution, feature flag evaluation, and runtime configuration updates through a provider-agnostic interface.

---

## Purpose

The Config Manager centralizes all platform configuration into a layered, scope-aware system. It resolves configuration values through a hierarchy (environment → service → global), supports feature flags for progressive rollouts, and persists all settings through DatabaseProvider with StateStoreProvider caching.

---

## Core Capabilities

### Config Service
- Hierarchical configuration resolution (environment → service → global scope chain)
- Key-value configuration CRUD operations
- Scoped configuration listing and filtering
- Configuration caching with TTL-based invalidation
- Batch configuration retrieval

### Feature Flag Service
- Boolean feature flag evaluation
- Flag creation, update, and deletion
- Flag listing with metadata
- Percentage-based rollout support
- User/tenant-scoped flag overrides

---

## Architecture

```
┌─────────────────────────────────────────┐
│          Config Manager                  │
│  ┌──────────────┐  ┌────────────────┐   │
│  │ConfigService  │  │FeatureFlagSvc  │   │
│  └──────┬───────┘  └───────┬────────┘   │
│         │                   │            │
│  ┌──────┴───────────────────┴────────┐   │
│  │        Provider Layer             │   │
│  │     database · stateStore         │   │
│  │     observability                 │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

---

## Provider Dependencies

| Provider | Usage |
|----------|-------|
| database | Persist configuration values, feature flags |
| stateStore | Configuration cache, flag evaluation cache |
| observability | Log config changes, track flag evaluations |

---

## Services

| Service | Methods | Description |
|---------|---------|-------------|
| ConfigService | get, set, delete, list, resolve | Hierarchical configuration |
| FeatureFlagService | isEnabled, getFlag, setFlag, listFlags | Feature flag management |

---

## Configuration Resolution

```
Request: get("database.pool.size", scope="auth-service")
     │
     ▼
1. Check scope: "auth-service" → database.pool.size = 20 ✓ → Return 20
2. Check scope: "global"       → database.pool.size = 10
3. Check default              → database.pool.size = 5
```

---

## Tier

**Tier 1** — Depends on core-kernel

---

## Philosophy

> Configuration is a native platform capability managed through Provider interfaces.
> External config services (Consul, etcd) are optional connected-mode enhancements.

---

## License

MIT — see LICENSE
