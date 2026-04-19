# CodexVanta OS — Control Center

**codexvanta-os-control-center** is the orchestration and platform management hub of CodexVanta OS. It provides multi-repository orchestration, service registry, and state tracking through a provider-agnostic interface.

---

> ⚠️ **Implementation Status (Scaffold Phase)**
>
> This module is in early scaffold phase with in-memory stub implementations.
>
> **Currently Implemented:**
> - `OrchestrationService` — basic in-memory repo tracking and action dispatch
> - `RegistryService` — simple service registration with sync stubs
>
> **Planned (Not Yet Implemented):**
> - State Tracking Service — real-time state observation, history, notifications
> - Database-backed persistence
> - Queue-based asynchronous dispatch
> - Kubernetes orchestration integration
>
> The services below describe the full intended architecture.

---

## Purpose

The Control Center is the central nervous system of CodexVanta OS. It coordinates operations across all 25 repositories, maintains a registry of all platform services, and tracks the state of every component in real-time.

---

## Core Capabilities

### Orchestration Service
- Multi-repository action execution (build, test, deploy, validate)
- Execution status tracking per repository
- Run cancellation and history
- Tier-aware execution ordering
- Queue-backed asynchronous dispatch

### Registry Service
- Service registration and discovery
- Service metadata management
- Service listing and filtering
- Heartbeat-based availability tracking

### State Tracking Service
- Platform-wide state observation
- State change notifications
- State history and audit trail
- Component health aggregation

---

## Architecture

```
┌───────────────────────────────────────────────┐
│           Control Center                       │
│  ┌───────────────────┐  ┌──────────────────┐  │
│  │OrchestrationSvc   │  │  RegistryService │  │
│  └────────┬──────────┘  └────────┬─────────┘  │
│  ┌────────┴──────────┐                         │
│  │StateTrackingService│                        │
│  └────────┬──────────┘                         │
│           │                                    │
│  ┌────────┴────────────────────────────────┐   │
│  │          Provider Layer                 │   │
│  │  database · stateStore · queue          │   │
│  │  observability                          │   │
│  └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

---

## Provider Dependencies

| Provider | Usage |
|----------|-------|
| database | Persist orchestration runs, service registry, state history |
| stateStore | Real-time state tracking, service heartbeats |
| queue | Asynchronous action dispatch across repositories |
| observability | Trace orchestration runs, log state changes |

---

## Services

| Service | Methods | Description |
|---------|---------|-------------|
| OrchestrationService | executeAction, getRunStatus, cancelRun | Multi-repo orchestration |
| RegistryService | register, unregister, discover, listAll | Service registry |
| StateTrackingService | getState, setState, watchState, getHistory | State observation |

---

## Tier

**Tier 1** — Depends on core-kernel

---

## Philosophy

> The control center orchestrates the platform natively.
> External orchestration tools extend but never replace the built-in coordination.

---

## License

MIT — see LICENSE
