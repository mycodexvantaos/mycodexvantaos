/**
 * CodexvantaOS — ObservabilityProvider
 * 
 * Abstract interface for logging, metrics, tracing, and alerting.
 * Native mode: file-based logs, in-memory metrics, console tracing
 * External mode: Prometheus, Grafana, Datadog, New Relic, OpenTelemetry,
 *                ELK Stack, CloudWatch, etc.
 * 
 * Follows the three pillars of observability: Logs, Metrics, Traces.
 * Plus alerting as a fourth operational concern.
 */

// ─── Log Types ────────────────────────────────────────────────────────────────

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: number;           // epoch ms
  level: LogLevel;
  message: string;
  service?: string;
  traceId?: string;
  spanId?: string;
  context?: Record<string, unknown>;
}

export interface LogQuery {
  service?: string;
  level?: LogLevel;            // minimum level
  since?: number;
  until?: number;
  search?: string;             // full-text search
  traceId?: string;
  limit?: number;
  offset?: number;
}

// ─── Metric Types ─────────────────────────────────────────────────────────────

export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  unit?: string;               // e.g. 'ms', 'bytes', 'requests'
  labels?: string[];           // allowed label names
}

export interface MetricDataPoint {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface MetricQuery {
  name: string;
  labels?: Record<string, string>;
  since?: number;
  until?: number;
  step?: number;               // aggregation step in seconds
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'p50' | 'p90' | 'p95' | 'p99';
}

export interface MetricQueryResult {
  name: string;
  labels?: Record<string, string>;
  dataPoints: Array<{ timestamp: number; value: number }>;
}

// ─── Trace Types ──────────────────────────────────────────────────────────────

export interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
}

export interface Span {
  context: SpanContext;
  operationName: string;
  service: string;
  startTime: number;           // epoch ms
  endTime?: number;
  duration?: number;           // ms
  status: 'ok' | 'error' | 'unset';
  attributes?: Record<string, unknown>;
  events?: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

export interface TraceQuery {
  traceId?: string;
  service?: string;
  operationName?: string;
  since?: number;
  until?: number;
  minDuration?: number;        // ms
  status?: 'ok' | 'error';
  limit?: number;
}

// ─── Alert Types ──────────────────────────────────────────────────────────────

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertState = 'firing' | 'resolved' | 'silenced' | 'acknowledged';

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  condition: string;           // provider-specific expression or DSL
  severity: AlertSeverity;
  enabled: boolean;
  cooldownSec?: number;
  notificationChannels?: string[];
  labels?: Record<string, string>;
}

export interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  state: AlertState;
  message: string;
  firedAt: number;
  resolvedAt?: number;
  acknowledgedBy?: string;
  labels?: Record<string, string>;
  values?: Record<string, number>;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface ObservabilityHealth {
  healthy: boolean;
  mode: 'native' | 'external';
  provider: string;
  capabilities: {
    logging: boolean;
    metrics: boolean;
    tracing: boolean;
    alerting: boolean;
  };
  logCount?: number;
  metricCount?: number;
  activeAlerts?: number;
  details?: Record<string, unknown>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ObservabilityProvider {
  readonly providerId: string;
  readonly mode: 'native' | 'external';

  /** Initialise all observability subsystems. */
  init(): Promise<void>;

  // ── Logging ─────────────────────────────────────────────────────────────

  /** Emit a log entry. */
  log(entry: LogEntry): void;

  /** Convenience methods for common log levels. */
  trace(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
  fatal(message: string, context?: Record<string, unknown>): void;

  /** Query stored logs. */
  queryLogs(query: LogQuery): Promise<LogEntry[]>;

  // ── Metrics ─────────────────────────────────────────────────────────────

  /** Register a metric definition. */
  registerMetric(definition: MetricDefinition): void;

  /** Record a metric data point. */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void;

  /** Increment a counter metric. */
  incrementCounter(name: string, delta?: number, labels?: Record<string, string>): void;

  /** Set a gauge metric value. */
  setGauge(name: string, value: number, labels?: Record<string, string>): void;

  /** Record a histogram observation. */
  observeHistogram(name: string, value: number, labels?: Record<string, string>): void;

  /** Query metric time-series data. */
  queryMetrics(query: MetricQuery): Promise<MetricQueryResult>;

  // ── Tracing ─────────────────────────────────────────────────────────────

  /** Start a new span (creates trace if no parent). Returns span context. */
  startSpan(operationName: string, options?: {
    parentContext?: SpanContext;
    service?: string;
    attributes?: Record<string, unknown>;
  }): SpanContext;

  /** Add an event to an active span. */
  addSpanEvent(spanId: string, event: SpanEvent): void;

  /** Set span attributes after creation. */
  setSpanAttributes(spanId: string, attributes: Record<string, unknown>): void;

  /** End a span, recording its duration and status. */
  endSpan(spanId: string, status?: 'ok' | 'error', errorMessage?: string): void;

  /** Query traces. */
  queryTraces(query: TraceQuery): Promise<Span[]>;

  // ── Alerting ────────────────────────────────────────────────────────────

  /** Create or update an alert rule. */
  upsertAlertRule?(rule: AlertRule): Promise<AlertRule>;

  /** List alert rules. */
  listAlertRules?(): Promise<AlertRule[]>;

  /** Delete an alert rule. */
  deleteAlertRule?(ruleId: string): Promise<void>;

  /** List active and recent alerts. */
  listAlerts?(options?: {
    state?: AlertState;
    severity?: AlertSeverity;
    since?: number;
    limit?: number;
  }): Promise<Alert[]>;

  /** Acknowledge a firing alert. */
  acknowledgeAlert?(alertId: string, acknowledgedBy: string): Promise<void>;

  /** Silence an alert rule for a duration. */
  silenceAlertRule?(ruleId: string, durationSec: number, reason?: string): Promise<void>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  /** Flush any buffered data (logs, metrics, traces). */
  flush(): Promise<void>;

  healthcheck(): Promise<ObservabilityHealth>;
  close(): Promise<void>;
}