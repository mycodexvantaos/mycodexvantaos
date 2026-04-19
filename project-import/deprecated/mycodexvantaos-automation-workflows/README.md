<div align="center">

# CodexVanta OS — Workflows

**Declarative Workflow Orchestration & Multi-Step Pipeline Engine**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-workflows/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-4-red)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`workflows` provides the declarative workflow orchestration and multi-step pipeline engine for CodexVanta OS. It enables complex, multi-service operations to be defined as YAML workflow definitions and executed reliably with full state tracking, error handling, and rollback support. Workflows coordinate across all platform services — triggering scans, running builds in sandboxes, evaluating policies, making governance decisions, and deploying artifacts — all through Provider interfaces.

## Key Capabilities

- **Declarative Definitions** — YAML-based workflow definitions with steps, conditions, and branches
- **Step Orchestration** — Sequential, parallel, and conditional step execution
- **State Machine** — Full state tracking with pause, resume, and cancel support
- **Error Handling** — Per-step error handlers, retry policies, and compensation actions
- **Rollback Support** — Automatic rollback on failure with compensation steps
- **Sub-Workflows** — Compose complex workflows from reusable sub-workflows
- **Trigger System** — Event-triggered, scheduled, manual, and API-triggered workflows

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                     workflows                             │
│                                                           │
│  ┌──────────────┐   ┌────────────────────┐               │
│  │ Workflow     │──▶│ Step               │               │
│  │ Definitions  │   │ Orchestrator       │               │
│  │ (YAML)       │   └────────┬───────────┘               │
│  └──────────────┘            │                            │
│                     ┌────────┼────────┐                   │
│                     ▼        ▼        ▼                   │
│               ┌────────┐┌────────┐┌────────┐             │
│               │ Step A ││ Step B ││ Step C │             │
│               │(serial)││(parall)││(condit)│             │
│               └────────┘└────────┘└────────┘             │
│                                                           │
│  ┌──────────────┐   ┌────────────────────┐               │
│  │ State        │   │ Rollback           │               │
│  │ Machine      │   │ Controller         │               │
│  └──────────────┘   └────────────────────┘               │
│                                                           │
│  ┌──────────────┐   ┌────────────────────┐               │
│  │ Trigger      │   │ Sub-Workflow       │               │
│  │ Manager      │   │ Compositor         │               │
│  └──────────────┘   └────────────────────┘               │
└──────────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| DatabaseProvider | Workflow definitions, execution history, state |
| StateStoreProvider | Active workflow state and step progress |
| QueueProvider | Step execution queue and event triggers |
| ObservabilityProvider | Workflow metrics, step duration, success rates |
| NotificationProvider | Workflow completion/failure notifications |
| All other Providers | Individual steps may invoke any platform capability |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | In-process step execution, SQLite state, local event triggers |
| **Connected** | Distributed step execution, PostgreSQL state, external triggers |
| **Hybrid** | Local orchestration with external step execution (sandboxes) |

## Directory Structure

```
codexvanta-os-workflows/
├── src/
│   ├── index.ts
│   └── services/
│       ├── WorkflowService.ts
│       ├── OrchestratorService.ts
│       ├── StepExecutorService.ts
│       └── TriggerService.ts
├── tests/
│   └── index.test.ts
├── REPO_MANIFEST.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## Dependency Tier

**Tier 4** — The highest tier; depends on services across all lower tiers.

```
Tier 0: core-kernel
  └─▶ Tier 1 → Tier 2 → Tier 3
       └─▶ Tier 4: workflows ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`scheduler`](../codexvanta-os-scheduler) — Scheduled workflow triggers
- [`automation-core`](../codexvanta-os-automation-core) — Automation steps within workflows
- [`fleet-sandbox`](../codexvanta-os-fleet-sandbox) — Sandboxed step execution

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
