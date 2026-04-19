<div align="center">

# CodexVanta OS — Event Bus

**Platform-Wide Asynchronous Event Messaging System**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-event-bus/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-1-brightgreen)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`event-bus` provides the platform-wide asynchronous event messaging system for CodexVanta OS. It enables decoupled communication between all services via a publish/subscribe pattern. In Native mode, it uses an in-memory event emitter with optional disk-backed persistence. In Connected mode, it delegates to external message brokers (Redis Pub/Sub, Kafka, RabbitMQ) via the QueueProvider interface.

## Key Capabilities

- **Publish/Subscribe** — Topic-based pub/sub with wildcard pattern matching
- **Event Persistence** — Optional durable event storage for replay and audit
- **Ordered Delivery** — Per-topic ordering guarantees within a partition
- **Dead Letter Handling** — Failed event processing routes to dead letter topic
- **Event Schema Registry** — Schema validation and versioning for all event types
- **Replay** — Replay events from a specific offset or timestamp
- **Fanout & Routing** — One event can trigger multiple subscribers with routing rules

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   event-bus                        │
│                                                    │
│  Publishers ──▶ ┌───────────────┐ ──▶ Subscribers │
│                 │   Topic       │                  │
│  Service A ──▶  │   Router      │  ──▶ Service X  │
│  Service B ──▶  │               │  ──▶ Service Y  │
│  Service C ──▶  │  ┌─────────┐  │  ──▶ Service Z  │
│                 │  │ Schema  │  │                  │
│                 │  │ Registry│  │                  │
│                 │  └─────────┘  │                  │
│                 └───────┬───────┘                  │
│                         │                          │
│                 ┌───────▼───────┐                  │
│                 │ Persistence   │                  │
│                 │ (Optional)    │                  │
│                 └───────────────┘                  │
└──────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| QueueProvider | Message transport (in-memory or external broker) |
| StateStoreProvider | Consumer offset and subscription state |
| ObservabilityProvider | Event throughput, latency, error rate metrics |
| DatabaseProvider | Persistent event log for replay |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | In-memory EventEmitter with optional SQLite persistence |
| **Connected** | Redis Pub/Sub or Kafka via QueueProvider |
| **Hybrid** | External broker for critical topics, in-memory for local events |

## Directory Structure

```
codexvanta-os-event-bus/
├── src/
│   ├── index.ts
│   └── services/
│       ├── EventBusService.ts
│       ├── TopicService.ts
│       ├── SubscriptionService.ts
│       └── EventPersistenceService.ts
├── tests/
│   └── index.test.ts
├── REPO_MANIFEST.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## Dependency Tier

**Tier 1** — Depends only on `core-kernel` (Tier 0).

```
Tier 0: core-kernel
  └─▶ Tier 1: event-bus ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`core-kernel`](../codexvanta-os-core-kernel) — QueueProvider interface
- [`data-pipeline`](../codexvanta-os-data-pipeline) — Consumes events for processing
- [`automation-core`](../codexvanta-os-automation-core) — Event-triggered automations

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
