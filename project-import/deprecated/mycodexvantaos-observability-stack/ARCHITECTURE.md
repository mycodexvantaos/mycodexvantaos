# Observability Stack — Architecture Document

## Purpose

`observability-stack` provides the three pillars of observability — metrics, logs, and traces — for the entire CodexVanta OS platform. It implements the ObservabilityProvider interface defined in `core-kernel`, giving every service a consistent API for telemetry emission.

## Three Pillars

```
┌─────────────────────────────────────────────┐
│            Observability Pillars             │
│                                              │
│  ┌───────────┐ ┌──────────┐ ┌────────────┐ │
│  │  Metrics  │ │   Logs   │ │   Traces   │ │
│  │           │ │          │ │            │ │
│  │ Counters  │ │ Struct'd │ │ Spans      │ │
│  │ Gauges    │ │ JSON     │ │ Propagation│ │
│  │ Histograms│ │ Levels   │ │ Context    │ │
│  └───────────┘ └──────────┘ └────────────┘ │
│                                              │
│         ┌─────────────────────┐              │
│         │ Correlation ID      │              │
│         │ (links all three)   │              │
│         └─────────────────────┘              │
└─────────────────────────────────────────────┘
```

## Metrics Model

```typescript
interface MetricDefinition {
  name: string;           // e.g., "http_requests_total"
  type: 'counter' | 'gauge' | 'histogram';
  labels: string[];       // Dimensional labels
  description: string;
  unit: string;           // e.g., "ms", "bytes", "requests"
}
```

### Built-in Platform Metrics

| Metric | Type | Description |
|---|---|---|
| `provider_init_duration_ms` | Histogram | Provider initialization time |
| `service_health_status` | Gauge | 1=healthy, 0=unhealthy |
| `event_bus_messages_total` | Counter | Events published per topic |
| `pipeline_records_processed` | Counter | Records per pipeline stage |
| `sandbox_execution_duration_ms` | Histogram | Sandbox run time |

## Logging Pipeline

```
Service Code
     │
     ▼
┌──────────────┐
│ Log Enricher │ ← adds correlationId, service, timestamp
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Log Router   │
└──────┬───────┘
       │
  ┌────┼────┐
  ▼    ▼    ▼
File  DB   External
            Exporter
```

## Distributed Tracing

```
Request enters core-main
     │
     ├── Span: bootstrap (core-main)
     │   ├── Span: provider-init (core-kernel)
     │   ├── Span: auth-check (auth-service)
     │   └── Span: config-load (config-manager)
     │
     └── Span: process-request (data-pipeline)
         ├── Span: ingest (data-pipeline)
         ├── Span: transform (data-pipeline)
         └── Span: store (database-provider)
```

## Alert Evaluation

```
Metric Stream
     │
     ▼
┌──────────────┐     ┌──────────────┐
│ Alert Rule   │────▶│ Notification │
│ Evaluator    │     │ Router       │
│              │     │              │
│ if rate > X  │     │ → Slack      │
│ for 5m       │     │ → Email      │
│ then alert   │     │ → Webhook    │
└──────────────┘     └──────────────┘
```

## Storage Strategy

| Mode | Metrics | Logs | Traces |
|---|---|---|---|
| Native | In-memory + SQLite | JSON files | SQLite spans |
| Connected | Prometheus | Elasticsearch | Jaeger |

## Design Principles

1. **Zero-Config Native** — Observability works out of the box without external services
2. **Correlation Everywhere** — Every telemetry signal carries a correlation ID
3. **Low Overhead** — Telemetry collection adds minimal latency
4. **Exportable** — All telemetry can be exported to external systems
5. **Self-Observable** — The observability stack monitors itself
