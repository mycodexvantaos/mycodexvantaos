<div align="center">

# CodexVanta OS — Module Suite

**Extensible Module System & Plugin Framework**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-module-suite/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-2-yellow)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`module-suite` provides the extensible module system and plugin framework for CodexVanta OS. It enables third-party and internal modules to extend platform capabilities through well-defined extension points. Modules are discovered, validated, loaded, and managed through a unified lifecycle. The module system enforces Provider-agnostic boundaries — modules can only interact with the platform through Provider interfaces and declared extension points.

## Key Capabilities

- **Module Discovery** — Automatic discovery of modules from registry, filesystem, or Git
- **Lifecycle Management** — Install, enable, disable, upgrade, uninstall with dependency resolution
- **Extension Points** — Well-defined hooks for modules to extend platform behavior
- **Sandboxed Execution** — Modules execute in isolated contexts with controlled permissions
- **Dependency Resolution** — Automatic module dependency graph resolution and conflict detection
- **Version Management** — Semantic versioning with compatibility matrix enforcement
- **Module Registry** — Central catalog of available and installed modules

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   module-suite                        │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Module       │──▶│ Dependency         │           │
│  │ Discovery    │   │ Resolver           │           │
│  └──────────────┘   └────────────────────┘           │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Lifecycle    │──▶│ Extension Point    │           │
│  │ Manager      │   │ Registry           │           │
│  └──────────────┘   └────────────────────┘           │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Module       │──▶│ Sandbox            │           │
│  │ Loader       │   │ Executor           │           │
│  └──────────────┘   └────────────────────┘           │
│                                                       │
│  ┌──────────────┐                                    │
│  │ Module       │                                    │
│  │ Registry     │                                    │
│  └──────────────┘                                    │
└──────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| StorageProvider | Module package storage and distribution |
| DatabaseProvider | Module registry, installed module inventory |
| ValidationProvider | Module manifest and code validation |
| ObservabilityProvider | Module execution metrics and health |
| StateStoreProvider | Module state and configuration |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | Filesystem-based module loading, in-process execution |
| **Connected** | Remote module registry (npm-like), container-isolated execution |
| **Hybrid** | Local modules with remote registry for discovery |

## Directory Structure

```
codexvanta-os-module-suite/
├── src/
│   ├── index.ts
│   └── services/
│       ├── ModuleSuiteService.ts
│       ├── ModuleDiscoveryService.ts
│       ├── LifecycleService.ts
│       └── ExtensionPointService.ts
├── tests/
│   └── index.test.ts
├── REPO_MANIFEST.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## Dependency Tier

**Tier 2** — Depends on `core-kernel` (Tier 0) and Tier 1 packages.

```
Tier 0: core-kernel
  └─▶ Tier 1: config-manager, ...
       └─▶ Tier 2: module-suite ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`core-kernel`](../codexvanta-os-core-kernel) — Provider interfaces that modules consume
- [`config-manager`](../codexvanta-os-config-manager) — Module configuration management
- [`fleet-sandbox`](../codexvanta-os-fleet-sandbox) — Sandbox execution for modules

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
