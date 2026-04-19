# CodexVanta OS — Control Center Architecture

> ⚠️ **Scaffold Phase Note**
>
> This document describes the target architecture. Current implementation is scaffold-grade with in-memory storage.
> See README.md for implemented vs planned feature status.

## Overview

The Control Center provides the orchestration, registry, and state management backbone for CodexVanta OS. It coordinates actions across all 25 repositories, maintains a live registry of services, and provides real-time state observation.

---

## Design Principles

1. **Tier-aware orchestration** — Actions are dispatched respecting the 5-tier dependency graph. Tier 0 builds before Tier 1, Tier 1 before Tier 2, and so on.

2. **Registry as source of truth** — The service registry is the authoritative record of what services exist, where they are, and whether they are healthy.

3. **State as observable stream** — Platform state is not just stored — it is observable. Components can watch for state changes and react accordingly.

4. **Queue-backed dispatch** — Orchestration actions are dispatched through QueueProvider for reliable, ordered execution.

---

## Orchestration Flow

```
Execute Action (repos[], action)
     │
     ▼
Group by Tier → Sort ascending
     │
     ▼
For each Tier:
  For each Repo:
    Dispatch to Queue → Track Status (stateStore)
     │
     ▼
Aggregate Results → Update Run Record (database)
     │
     ▼
Return Run Status
```

## Registry Flow

```
Register Service → Store in database + heartbeat in stateStore
     │
Discover Service → Query database → Verify heartbeat
     │
Unregister Service → Remove from database + clear heartbeat
```

---

## Provider Usage Map

| Service | database | stateStore | queue | observability |
|---------|----------|------------|-------|---------------|
| OrchestrationService | runs | status | dispatch | trace |
| RegistryService | registry | heartbeats | — | log |
| StateTrackingService | history | state | — | log |

---

## Dependencies

- **Tier 1** in the CodexVanta OS dependency hierarchy
- Depends on: core-kernel
- Consumed by: all services requiring platform coordination
