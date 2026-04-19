<div align="center">

# CodexVanta OS — Scheduler

**Task Scheduling, Cron Jobs & Timed Execution Engine**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-scheduler/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-2-yellow)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`scheduler` provides the task scheduling, cron job management, and timed execution engine for CodexVanta OS. It manages periodic tasks (repository scans, compliance checks, report generation), delayed executions, and scheduled workflows. In Native mode, it uses an in-process timer-based scheduler with SQLite-backed persistence. In Connected mode, it can delegate to external schedulers (Kubernetes CronJobs, AWS EventBridge, cloud scheduler services).

## Key Capabilities

- **Cron Scheduling** — Standard cron expression support for periodic tasks
- **Delayed Execution** — Schedule one-time tasks for future execution
- **Recurring Jobs** — Configurable repeat intervals with jitter support
- **Job Queuing** — Priority-based job queue with concurrency limits
- **Failure Retry** — Automatic retry with configurable backoff strategies
- **Job History** — Complete execution history with duration and outcome
- **Distributed Locking** — Prevents duplicate execution in multi-instance deployments

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    scheduler                          │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Cron         │──▶│ Job                │           │
│  │ Parser       │   │ Queue              │           │
│  └──────────────┘   └────────┬───────────┘           │
│                              │                        │
│  ┌──────────────┐   ┌───────▼────────────┐           │
│  │ Timer        │──▶│ Execution          │           │
│  │ Engine       │   │ Controller         │           │
│  └──────────────┘   └────────┬───────────┘           │
│                              │                        │
│  ┌──────────────┐   ┌───────▼────────────┐           │
│  │ Distributed  │   │ Result             │           │
│  │ Lock Manager │   │ Recorder           │           │
│  └──────────────┘   └────────────────────┘           │
└──────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| DatabaseProvider | Job definitions, execution history, schedule state |
| StateStoreProvider | Distributed locks, active job tracking |
| QueueProvider | Job queue with priority ordering |
| ObservabilityProvider | Job execution metrics, schedule drift |
| NotificationProvider | Job failure alerts |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | In-process setInterval/setTimeout, SQLite job store |
| **Connected** | Kubernetes CronJobs, Redis-based distributed locking |
| **Hybrid** | Native timer with external lock manager for HA |

## Directory Structure

```
codexvanta-os-scheduler/
├── src/
│   ├── index.ts
│   └── services/
│       ├── SchedulerService.ts
│       ├── CronService.ts
│       ├── JobQueueService.ts
│       └── ExecutionService.ts
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
  └─▶ Tier 1: config-manager, event-bus, ...
       └─▶ Tier 2: scheduler ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`automation-core`](../codexvanta-os-automation-core) — Scheduled automation tasks
- [`workflows`](../codexvanta-os-workflows) — Scheduled workflow triggers
- [`fleet-sandbox`](../codexvanta-os-fleet-sandbox) — Sandbox execution for scheduled jobs

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
