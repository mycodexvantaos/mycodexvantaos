# Module Suite — Architecture Document

## Purpose

`module-suite` provides the extensibility framework for CodexVanta OS. It defines how external and internal modules integrate with the platform through controlled extension points while maintaining Provider-agnostic boundaries.

## Module Manifest

Every module declares its capabilities and requirements:

```yaml
module:
  name: "@codexvanta/example-module"
  version: "1.0.0"
  description: "Example module"
  
  requires:
    platform: ">=1.0.0"
    providers:
      - DatabaseProvider
      - StorageProvider
    modules:
      - "@codexvanta/config-manager@^1.0.0"
  
  extends:
    - point: "repository.scan.post"
      handler: "./handlers/post-scan.js"
    - point: "dashboard.widget"
      handler: "./widgets/status.js"
  
  permissions:
    - "database:read"
    - "storage:read:write"
    - "notification:send"
```

## Extension Point Model

```
Platform Service
      │
      ├── Extension Point: "pre-action"
      │       │
      │       ├── Module A handler
      │       └── Module B handler
      │
      ├── Core Logic
      │
      └── Extension Point: "post-action"
              │
              ├── Module C handler
              └── Module D handler
```

## Module Lifecycle

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Discover │──▶│ Validate │──▶│ Install  │──▶│ Enable   │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                    │
                                              ┌─────▼─────┐
                                              │ Running   │
                                              └─────┬─────┘
                                                    │
                              ┌──────────┐   ┌──────▼─────┐
                              │ Uninstall│◀──│ Disable    │
                              └──────────┘   └────────────┘
```

## Dependency Resolution

```
Module A (requires B, C)
Module B (requires D)
Module C (no dependencies)
Module D (no dependencies)

Resolution order: D → B → C → A
```

Conflict detection handles:
- Version incompatibilities
- Circular dependencies
- Missing required providers
- Permission conflicts

## Sandboxed Execution

Modules execute with restricted access:

| Permission | Description |
|---|---|
| `provider:read` | Read-only access to named Provider |
| `provider:read:write` | Full access to named Provider |
| `extension:hook` | Can register extension point handlers |
| `notification:send` | Can send notifications |
| `event:publish` | Can publish events to event-bus |

## Design Principles

1. **Controlled Extensibility** — Modules extend only through declared extension points
2. **Provider-Agnostic Modules** — Modules use Provider interfaces, never direct implementations
3. **Explicit Permissions** — No implicit access; all capabilities declared in manifest
4. **Safe Uninstall** — Removing a module cleanly removes all its extension registrations
5. **Version Compatibility** — Strict semantic versioning for module-platform compatibility
