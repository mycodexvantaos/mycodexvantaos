# Data Pipeline — Architecture Document

## Purpose

`data-pipeline` provides a streaming data processing engine that ingests, transforms, and routes data through configurable pipeline stages. It abstracts all I/O behind Provider interfaces, enabling the same pipeline definitions to run against in-memory streams (Native) or distributed systems (Connected).

## Pipeline Model

```
Source → Ingestion → [Stage 1] → [Stage 2] → ... → [Stage N] → Sink
                          │
                          ▼
                     Schema Validation
                          │
                     ┌────┴────┐
                     │ Pass    │ Fail
                     ▼         ▼
                  Continue   Dead Letter Queue
```

## Stage Types

| Stage | Description |
|---|---|
| **Filter** | Drops records not matching predicate |
| **Map** | Transforms record shape |
| **Enrich** | Adds data from external lookups |
| **Aggregate** | Windows and aggregates records |
| **Deduplicate** | Removes duplicate records by key |
| **Branch** | Splits stream into multiple paths |

## Backpressure Strategy

1. **Buffer** — In-memory ring buffer with configurable capacity
2. **Overflow Policy** — Drop-oldest, drop-newest, or block-producer
3. **Checkpoint** — Periodic cursor save to StateStoreProvider for recovery
4. **Replay** — Restart from last checkpoint on failure

## Data Flow Through Providers

```
QueueProvider          DatabaseProvider       StorageProvider
(buffering)            (structured data)      (large blobs)
     │                       │                      │
     ▼                       ▼                      ▼
┌──────────┐          ┌──────────┐           ┌──────────┐
│ Ingestion│          │ Processed│           │ Raw      │
│ Buffer   │──────▶   │ Records  │           │ Payloads │
└──────────┘          └──────────┘           └──────────┘
```

## Pipeline Definition (Declarative)

```yaml
pipeline:
  name: repo-events
  source:
    type: event-bus
    topic: repository.*
  stages:
    - type: filter
      predicate: "event.type !== 'ping'"
    - type: enrich
      lookup: repository-metadata
    - type: aggregate
      window: 5m
      groupBy: repository.id
  sink:
    type: database
    table: repo_event_aggregates
```

## Error Handling

- Schema validation failures → Dead Letter Queue
- Transformation errors → Logged + DLQ with original record
- Sink failures → Retry with exponential backoff, then DLQ
- Pipeline crash → Restart from last StateStoreProvider checkpoint

## Design Principles

1. **Provider-Agnostic I/O** — All sources and sinks go through Provider interfaces
2. **Declarative Pipelines** — Pipeline definitions are data, not code
3. **Backpressure-Aware** — Never overwhelm downstream consumers
4. **Exactly-Once Semantics** — Checkpoint + deduplication for reliable processing
5. **Observable** — Every stage emits metrics via ObservabilityProvider
