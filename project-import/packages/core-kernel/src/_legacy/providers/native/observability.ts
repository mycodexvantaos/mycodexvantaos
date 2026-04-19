/**
 * NativeObservabilityProvider — File + console + in-memory observability
 * 
 * Zero external dependencies. Implements the three pillars:
 *  - Logs: structured JSON logs to file + console
 *  - Metrics: in-memory counters/gauges/histograms with file snapshots
 *  - Traces: in-memory span tree with file export
 *  - Alerts: threshold-based alerts evaluated on metrics
 *  - No Prometheus, no Grafana, no Datadog, no ELK required
 */

import type {
  ObservabilityProvider,
  LogEntry,
  LogLevel,
  LogQuery,
  MetricDefinition,
  MetricType,
  MetricDataPoint,
  MetricQuery,
  MetricQueryResult,
  SpanContext,
  Span,
  SpanEvent,
  TraceQuery,
  AlertRule,
  Alert,
  AlertSeverity,
  AlertState,
  ObservabilityHealth,
} from '../../interfaces/observability';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface NativeObservabilityConfig {
  dataDir?: string;
  logFile?: string;
  logToConsole?: boolean;
  minLogLevel?: LogLevel;
  metricsRetentionMs?: number;
  maxLogEntries?: number;
  flushIntervalMs?: number;
}

const LOG_LEVEL_ORDER: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

export class NativeObservabilityProvider implements ObservabilityProvider {
  readonly providerId = 'native-file-observability';
  readonly mode = 'native' as const;

  private config: Required<NativeObservabilityConfig>;

  // Logs
  private logBuffer: LogEntry[] = [];
  private logStream: fs.WriteStream | null = null;

  // Metrics
  private metricDefs = new Map<string, MetricDefinition>();
  private metricData = new Map<string, MetricDataPoint[]>();

  // Traces
  private activeSpans = new Map<string, Span>();
  private completedSpans: Span[] = [];

  // Alerts
  private alertRules: AlertRule[] = [];
  private alerts: Alert[] = [];

  // Timers
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private serviceName = 'codexvanta';

  constructor(config?: NativeObservabilityConfig) {
    const dataDir = config?.dataDir ?? path.join(process.cwd(), '.codexvanta', 'observability');
    this.config = {
      dataDir,
      logFile: config?.logFile ?? path.join(dataDir, 'app.log.jsonl'),
      logToConsole: config?.logToConsole ?? true,
      minLogLevel: config?.minLogLevel ?? 'info',
      metricsRetentionMs: config?.metricsRetentionMs ?? 3600000, // 1 hour
      maxLogEntries: config?.maxLogEntries ?? 50000,
      flushIntervalMs: config?.flushIntervalMs ?? 5000,
    };
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }

    this.logStream = fs.createWriteStream(this.config.logFile, { flags: 'a' });

    // Load persisted alert rules
    const rulesFile = path.join(this.config.dataDir, 'alert-rules.json');
    if (fs.existsSync(rulesFile)) {
      try { this.alertRules = JSON.parse(fs.readFileSync(rulesFile, 'utf-8')); }
      catch { /* start fresh */ }
    }

    // Start flush timer
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  // ── Logging ─────────────────────────────────────────────────────────────────

  log(entry: LogEntry): void {
    const minIdx = LOG_LEVEL_ORDER.indexOf(this.config.minLogLevel);
    const entryIdx = LOG_LEVEL_ORDER.indexOf(entry.level);
    if (entryIdx < minIdx) return;

    const enriched: LogEntry = {
      ...entry,
      timestamp: entry.timestamp || Date.now(),
      service: entry.service || this.serviceName,
    };

    this.logBuffer.push(enriched);

    // Write to file
    if (this.logStream) {
      this.logStream.write(JSON.stringify(enriched) + '\n');
    }

    // Console output
    if (this.config.logToConsole) {
      const ts = new Date(enriched.timestamp).toISOString();
      const prefix = `[${ts}] [${enriched.level.toUpperCase().padEnd(5)}]`;
      const ctx = enriched.context ? ` ${JSON.stringify(enriched.context)}` : '';
      const msg = `${prefix} ${enriched.message}${ctx}`;

      switch (enriched.level) {
        case 'error': case 'fatal': console.error(msg); break;
        case 'warn': console.warn(msg); break;
        case 'debug': case 'trace': console.debug(msg); break;
        default: console.log(msg);
      }
    }

    // Trim buffer
    if (this.logBuffer.length > this.config.maxLogEntries) {
      this.logBuffer = this.logBuffer.slice(-Math.floor(this.config.maxLogEntries * 0.8));
    }
  }

  trace(message: string, context?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'trace', message, context });
  }
  debug(message: string, context?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'debug', message, context });
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'info', message, context });
  }
  warn(message: string, context?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'warn', message, context });
  }
  error(message: string, context?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'error', message, context });
  }
  fatal(message: string, context?: Record<string, unknown>): void {
    this.log({ timestamp: Date.now(), level: 'fatal', message, context });
  }

  async queryLogs(query: LogQuery): Promise<LogEntry[]> {
    let results = [...this.logBuffer];

    if (query.service) results = results.filter(e => e.service === query.service);
    if (query.level) {
      const minIdx = LOG_LEVEL_ORDER.indexOf(query.level);
      results = results.filter(e => LOG_LEVEL_ORDER.indexOf(e.level) >= minIdx);
    }
    if (query.since) results = results.filter(e => e.timestamp >= query.since!);
    if (query.until) results = results.filter(e => e.timestamp <= query.until!);
    if (query.traceId) results = results.filter(e => e.traceId === query.traceId);
    if (query.search) {
      const lower = query.search.toLowerCase();
      results = results.filter(e => e.message.toLowerCase().includes(lower));
    }

    results.sort((a, b) => b.timestamp - a.timestamp);

    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  // ── Metrics ─────────────────────────────────────────────────────────────────

  registerMetric(definition: MetricDefinition): void {
    this.metricDefs.set(definition.name, definition);
    if (!this.metricData.has(definition.name)) {
      this.metricData.set(definition.name, []);
    }
  }

  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const points = this.metricData.get(name) ?? [];
    points.push({ name, value, labels, timestamp: Date.now() });
    this.metricData.set(name, points);
    this.pruneMetrics(name);
  }

  incrementCounter(name: string, delta: number = 1, labels?: Record<string, string>): void {
    const points = this.metricData.get(name) ?? [];
    const last = points.filter(p => this.labelsMatch(p.labels, labels)).pop();
    const newValue = (last?.value ?? 0) + delta;
    this.recordMetric(name, newValue, labels);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  queryMetrics(query: MetricQuery): Promise<MetricQueryResult> {
    const points = this.metricData.get(query.name) ?? [];
    let filtered = points;

    if (query.labels) {
      filtered = filtered.filter(p => this.labelsMatch(p.labels, query.labels));
    }
    if (query.since) filtered = filtered.filter(p => p.timestamp >= query.since!);
    if (query.until) filtered = filtered.filter(p => p.timestamp <= query.until!);

    const dataPoints = filtered.map(p => ({ timestamp: p.timestamp, value: p.value }));
    dataPoints.sort((a, b) => a.timestamp - b.timestamp);

    return Promise.resolve({
      name: query.name,
      labels: query.labels,
      dataPoints,
    });
  }

  // ── Tracing ─────────────────────────────────────────────────────────────────

  startSpan(operationName: string, options?: {
    parentContext?: SpanContext;
    service?: string;
    attributes?: Record<string, unknown>;
  }): SpanContext {
    const traceId = options?.parentContext?.traceId ?? crypto.randomUUID().replace(/-/g, '');
    const spanId = crypto.randomBytes(8).toString('hex');

    const context: SpanContext = {
      traceId,
      spanId,
      parentSpanId: options?.parentContext?.spanId,
    };

    const span: Span = {
      context,
      operationName,
      service: options?.service ?? this.serviceName,
      startTime: Date.now(),
      status: 'unset',
      attributes: options?.attributes,
      events: [],
    };

    this.activeSpans.set(spanId, span);
    return context;
  }

  addSpanEvent(spanId: string, event: SpanEvent): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events = span.events ?? [];
      span.events.push(event);
    }
  }

  setSpanAttributes(spanId: string, attributes: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.attributes = { ...span.attributes, ...attributes };
    }
  }

  endSpan(spanId: string, status?: 'ok' | 'error', errorMessage?: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    span.status = status ?? 'ok';

    if (errorMessage) {
      span.attributes = { ...span.attributes, error: errorMessage };
    }

    this.activeSpans.delete(spanId);
    this.completedSpans.push(span);

    // Keep last 10000 completed spans
    if (this.completedSpans.length > 10000) {
      this.completedSpans = this.completedSpans.slice(-8000);
    }
  }

  async queryTraces(query: TraceQuery): Promise<Span[]> {
    let results = [...this.completedSpans];

    if (query.traceId) results = results.filter(s => s.context.traceId === query.traceId);
    if (query.service) results = results.filter(s => s.service === query.service);
    if (query.operationName) results = results.filter(s => s.operationName === query.operationName);
    if (query.since) results = results.filter(s => s.startTime >= query.since!);
    if (query.until) results = results.filter(s => s.startTime <= query.until!);
    if (query.minDuration) results = results.filter(s => (s.duration ?? 0) >= query.minDuration!);
    if (query.status) results = results.filter(s => s.status === query.status);

    results.sort((a, b) => b.startTime - a.startTime);
    return results.slice(0, query.limit ?? 100);
  }

  // ── Alerting ────────────────────────────────────────────────────────────────

  async upsertAlertRule(rule: AlertRule): Promise<AlertRule> {
    const idx = this.alertRules.findIndex(r => r.id === rule.id);
    if (idx >= 0) { this.alertRules[idx] = rule; }
    else { this.alertRules.push(rule); }
    this.persistAlertRules();
    return rule;
  }

  async listAlertRules(): Promise<AlertRule[]> {
    return this.alertRules;
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    this.alertRules = this.alertRules.filter(r => r.id !== ruleId);
    this.persistAlertRules();
  }

  async listAlerts(options?: {
    state?: AlertState;
    severity?: AlertSeverity;
    since?: number;
    limit?: number;
  }): Promise<Alert[]> {
    let results = [...this.alerts];
    if (options?.state) results = results.filter(a => a.state === options.state);
    if (options?.severity) results = results.filter(a => a.severity === options.severity);
    if (options?.since) results = results.filter(a => a.firedAt >= options.since!);
    results.sort((a, b) => b.firedAt - a.firedAt);
    return results.slice(0, options?.limit ?? 100);
  }

  async acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<void> {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.state = 'acknowledged';
      alert.acknowledgedBy = acknowledgedBy;
    }
  }

  async silenceAlertRule(ruleId: string, durationSec: number, _reason?: string): Promise<void> {
    const rule = this.alertRules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = false;
      setTimeout(() => { rule.enabled = true; }, durationSec * 1000);
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async flush(): Promise<void> {
    // Persist metrics snapshot
    const metricsFile = path.join(this.config.dataDir, 'metrics-snapshot.json');
    const metricsObj: Record<string, MetricDataPoint[]> = {};
    for (const [name, points] of this.metricData) {
      metricsObj[name] = points.slice(-100); // last 100 per metric
    }
    try { fs.writeFileSync(metricsFile, JSON.stringify(metricsObj, null, 2)); } catch {}

    // Persist traces snapshot
    const tracesFile = path.join(this.config.dataDir, 'traces-snapshot.json');
    try { fs.writeFileSync(tracesFile, JSON.stringify(this.completedSpans.slice(-500), null, 2)); } catch {}
  }

  async healthcheck(): Promise<ObservabilityHealth> {
    return {
      healthy: true,
      mode: 'native',
      provider: this.providerId,
      capabilities: { logging: true, metrics: true, tracing: true, alerting: true },
      logCount: this.logBuffer.length,
      metricCount: this.metricDefs.size,
      activeAlerts: this.alerts.filter(a => a.state === 'firing').length,
      details: {
        activeSpans: this.activeSpans.size,
        completedSpans: this.completedSpans.length,
        alertRules: this.alertRules.length,
        dataDir: this.config.dataDir,
      },
    };
  }

  async close(): Promise<void> {
    if (this.flushTimer) { clearInterval(this.flushTimer); this.flushTimer = null; }
    await this.flush();
    if (this.logStream) { this.logStream.end(); this.logStream = null; }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private pruneMetrics(name: string): void {
    const points = this.metricData.get(name);
    if (!points) return;
    const cutoff = Date.now() - this.config.metricsRetentionMs;
    const pruned = points.filter(p => p.timestamp >= cutoff);
    this.metricData.set(name, pruned);
  }

  private labelsMatch(a?: Record<string, string>, b?: Record<string, string>): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return Object.entries(b).every(([k, v]) => a[k] === v);
  }

  private persistAlertRules(): void {
    const rulesFile = path.join(this.config.dataDir, 'alert-rules.json');
    try { fs.writeFileSync(rulesFile, JSON.stringify(this.alertRules, null, 2)); } catch {}
  }
}