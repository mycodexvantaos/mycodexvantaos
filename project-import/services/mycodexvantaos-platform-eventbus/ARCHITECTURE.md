# Event Bus — Architecture Document

## Purpose

`event-bus` provides the asynchronous communication backbone for the entire CodexVanta OS platform. All inter-service communication that doesn't require synchronous request/response flows through the event bus, enabling loose coupling and independent scalability.

## Messaging Model

```
┌──────────┐    publish()     ┌──────────────┐    deliver()    ┌──────────┐
│ Producer │ ───────────────▶ │  Topic        │ ─────────────▶ │ Consumer │
│          │                  │  "repo.scan"  │                │          │
└──────────┘                  └──────────────┘                └──────────┘
                                     │
                              ┌──────▼──────┐
                              │ Persistence  │
                              │ Layer        │
                              └─────────────┘
```

## Topic Naming Convention

```
{domain}.{entity}.{action}

Examples:
  repository.scan.completed
  policy.violation.detected
  deploy.release.started
  governance.approval.requested
```

## Subscription Patterns

| Pattern | Example | Matches |
|---|---|---|
| Exact | `repository.scan.completed` | Only exact topic |
| Wildcard | `repository.scan.*` | All scan actions |
| Multi-wildcard | `repository.#` | All repository events |

## Consumer Groups

Multiple instances of the same service form a consumer group. Each event is delivered to exactly one instance in the group, enabling horizontal scaling:

```
                    ┌──────────────┐
               ┌───▶│ Instance A   │
               │    └──────────────┘
Topic ─── Group ─┤
               │    ┌──────────────┐
               └───▶│ Instance B   │  (round-robin within group)
                    └──────────────┘
```

## Event Schema

```typescript
interface PlatformEvent<T = unknown> {
  id: string;
  type: string;          // Topic name
  source: string;        // Producing service
  timestamp: Date;
  version: string;       // Schema version
  correlationId: string; // Request tracing
  payload: T;
  metadata: Record<string, string>;
}
```

## Delivery Guarantees

| Mode | Guarantee |
|---|---|
| Native | At-least-once (with persistence), at-most-once (without) |
| Connected | Depends on external broker configuration |

## Error Handling

1. **Consumer Failure** — Retry with exponential backoff (configurable max retries)
2. **Permanent Failure** — Route to dead letter topic `{original-topic}.dlq`
3. **Broker Unavailable** — Buffer in memory, flush when reconnected
4. **Schema Mismatch** — Reject with validation error, route to DLQ

## Design Principles

1. **Fire and Forget for Producers** — Publishers don't wait for consumer acknowledgment
2. **At-Least-Once Default** — Prefer duplicate delivery over message loss
3. **Schema Evolution** — Backward-compatible schema changes only
4. **Observable** — Every publish/consume emits metrics
5. **Provider-Agnostic Transport** — Same API regardless of underlying broker
