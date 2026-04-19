# Scheduler — Architecture Document

## Purpose

`scheduler` manages all timed and periodic execution within CodexVanta OS. It ensures tasks run on schedule, handles failures gracefully, and prevents duplicate execution in distributed deployments.

## Scheduling Model

```
┌─────────────────────────────────────────────┐
│              Job Definition                  │
│                                              │
│  ┌────────────┐  ┌────────────┐             │
│  │ Cron       │  │ One-Time   │             │
│  │ "0 * * * *"│  │ at: 2024.. │             │
│  └─────┬──────┘  └─────┬──────┘             │
│        │                │                    │
│        └───────┬────────┘                    │
│                ▼                              │
│  ┌─────────────────────┐                     │
│  │   Timer Engine      │                     │
│  │   (next-tick calc)  │                     │
│  └──────────┬──────────┘                     │
│             │                                │
│             ▼                                │
│  ┌─────────────────────┐                     │
│  │   Job Queue         │                     │
│  │   (priority-sorted) │                     │
│  └──────────┬──────────┘                     │
│             │                                │
│             ▼                                │
│  ┌─────────────────────┐                     │
│  │   Execution         │                     │
│  │   Controller        │                     │
│  └─────────────────────┘                     │
└─────────────────────────────────────────────┘
```

## Cron Expression Support

```
┌───────── minute (0-59)
│ ┌───────── hour (0-23)
│ │ ┌───────── day of month (1-31)
│ │ │ ┌───────── month (1-12)
│ │ │ │ ┌───────── day of week (0-7)
│ │ │ │ │
* * * * *
```

Extended support: `@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`

## Job Lifecycle

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Scheduled│──▶│ Queued   │──▶│ Running  │──▶│ Complete │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
                                    │
                              ┌─────▼─────┐
                              │ Failed    │──▶ Retry / DLQ
                              └───────────┘
```

## Distributed Locking

```
Instance A                    Instance B
     │                             │
     ├── acquire lock ─────▶ ┌─────────┐
     │                       │ State   │
     │   ✅ granted          │ Store   │
     │                       └────┬────┘
     ├── execute job              │
     │                            │
     │                       ├── acquire lock
     │                       │   ❌ denied (held)
     │                       │
     ├── release lock ──────▶│
     │                       │
```

## Failure Handling

| Strategy | Description |
|---|---|
| Immediate Retry | Retry once immediately |
| Exponential Backoff | 1s, 2s, 4s, 8s, ... up to max |
| Fixed Delay | Constant delay between retries |
| Dead Letter | After max retries, move to DLQ |

## Design Principles

1. **At-Most-Once Execution** — Distributed locking prevents duplicate runs
2. **Persistent Schedules** — Survive restarts without losing scheduled jobs
3. **Observable Scheduling** — Every tick, execution, and failure is metriced
4. **Configurable Retry** — Per-job retry strategy customization
5. **Graceful Degradation** — Lock acquisition failure = skip, not crash
