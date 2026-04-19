<div align="center">

# CodexVanta OS — Fleet Sandbox

**Isolated Execution Environments for Multi-Repository Operations**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-fleet-sandbox/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-2-yellow)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`fleet-sandbox` provides isolated execution environments for running multi-repository operations safely. It creates sandboxed contexts where repository clones, builds, tests, and deployments can execute without affecting the host system or other concurrent operations. In Native mode, sandboxes use filesystem isolation with tmpdir-based workspaces. In Connected mode, sandboxes can leverage container runtimes or cloud-based ephemeral environments.

## Key Capabilities

- **Sandbox Lifecycle** — Create, configure, execute, inspect, and destroy sandboxes
- **Filesystem Isolation** — Each sandbox gets its own workspace directory with controlled access
- **Resource Limits** — CPU, memory, and time limits per sandbox execution
- **Artifact Collection** — Extracts build artifacts, test results, and logs from sandboxes
- **Parallel Execution** — Run multiple sandboxes concurrently with resource pooling
- **Reproducibility** — Deterministic sandbox setup from declarative specifications
- **Cleanup Guarantees** — Automatic cleanup on completion, failure, or timeout

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                  fleet-sandbox                         │
│                                                        │
│  ┌──────────────┐   ┌────────────────┐                │
│  │ Sandbox      │──▶│ Workspace      │                │
│  │ Manager      │   │ Provisioner    │                │
│  └──────┬───────┘   └────────────────┘                │
│         │                                              │
│  ┌──────▼───────┐   ┌────────────────┐                │
│  │ Execution    │──▶│ Resource       │                │
│  │ Controller   │   │ Limiter        │                │
│  └──────┬───────┘   └────────────────┘                │
│         │                                              │
│  ┌──────▼───────┐   ┌────────────────┐                │
│  │ Artifact     │──▶│ Cleanup        │                │
│  │ Collector    │   │ Service        │                │
│  └──────────────┘   └────────────────┘                │
└──────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| StorageProvider | Workspace provisioning and artifact storage |
| RepoProvider | Repository cloning into sandboxes |
| StateStoreProvider | Sandbox state tracking and queue management |
| ObservabilityProvider | Sandbox execution metrics and resource usage |
| DatabaseProvider | Sandbox history and execution logs |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | tmpdir-based filesystem isolation, process-level resource limits |
| **Connected** | Container-based isolation (Docker/Podman), cloud ephemeral environments |
| **Hybrid** | Local filesystem with external artifact storage |

## Directory Structure

```
codexvanta-os-fleet-sandbox/
├── src/
│   ├── index.ts
│   └── services/
│       ├── FleetSandboxService.ts
│       ├── SandboxManagerService.ts
│       ├── ExecutionService.ts
│       └── ArtifactService.ts
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
  └─▶ Tier 1: config-manager, auth-service, ...
       └─▶ Tier 2: fleet-sandbox ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`scheduler`](../codexvanta-os-scheduler) — Schedules sandbox executions
- [`automation-core`](../codexvanta-os-automation-core) — Triggers sandbox runs for automated tasks
- [`workflows`](../codexvanta-os-workflows) — Workflow steps execute inside sandboxes

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
