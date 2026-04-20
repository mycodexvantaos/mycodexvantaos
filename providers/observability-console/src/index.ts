/**
 * MyCodexVantaOS Console Observability Provider
 * 
 * Native console-based observability provider implementing the ObservabilityProvider interface
 * Following naming-spec-v1 §8.1: observability-console
 * 
 * @package @mycodexvantaos/observability-console
 * @version 1.0.0
 */

import {
  ObservabilityProvider,
  HealthCheckResult,
  ProviderSource,
  ProviderCriticality,
  ResolvedMode,
} from '@mycodexvantaos/namespaces-sdk';

/**
 * Console observability provider configuration
 */
export interface ConsoleObservabilityConfig {
  /** Output format: 'json' or 'pretty' */
  format?: 'json' | 'pretty';
  /** Minimum log level: 'debug', 'info', 'warn', 'error' */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  /** Include timestamp in logs */
  includeTimestamp?: boolean;
  /** Include service name in logs */
  serviceName?: string;
  /** Enable color output (pretty mode only) */
  colorize?: boolean;
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Enable tracing */
  enableTracing?: boolean;
}

/**
 * Log entry structure
 */
interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  service?: string;
  metadata?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
}

/**
 * Metric entry structure
 */
interface MetricEntry {
  timestamp: string;
  name: string;
  value: number;
  type: 'counter' | 'gauge' | 'histogram';
  labels: Record<string, string>;
}

/**
 * Span context for tracing
 */
interface SpanContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: number }>;
}

/**
 * Log level priority
 */
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const;

/**
 * Console Observability Provider
 * 
 * Provides native observability capability for MyCodexVantaOS
 */
export class ConsoleObservabilityProvider implements ObservabilityProvider {
  readonly capability = 'observability' as const;
  readonly source: ProviderSource = 'native';
  readonly criticality: ProviderCriticality = 'medium';
  readonly supportsModes: ResolvedMode[] = ['native', 'hybrid'];

  private config: ConsoleObservabilityConfig;
  private initialized: boolean = false;
  private metrics: Map<string, MetricEntry[]> = new Map();
  private activeSpans: Map<string, SpanContext> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();

  constructor(config: ConsoleObservabilityConfig = {}) {
    this.config = {
      format: 'json',
      logLevel: 'info',
      includeTimestamp: true,
      colorize: true,
      enableMetrics: true,
      enableTracing: true,
      ...config,
    };
  }

  /**
   * Initialize the observability provider
   */
  async initialize(config?: unknown): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Merge configuration
    this.config = {
      ...this.config,
      ...(config as ConsoleObservabilityConfig || {}),
    };

    this.initialized = true;
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (!this.initialized) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        message: 'Observability provider not initialized',
      };
    }

    return {
      status: 'healthy',
      timestamp: new Date(),
      message: 'Console observability provider is ready',
      details: {
        format: this.config.format,
        logLevel: this.config.logLevel,
        metricsEnabled: this.config.enableMetrics,
        tracingEnabled: this.config.enableTracing,
        activeSpans: this.activeSpans.size,
        recordedMetrics: this.metrics.size,
      },
    };
  }

  /**
   * Log a message
   */
  async log(
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    this.ensureInitialized();

    // Check log level
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.logLevel!]) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.config.serviceName,
      metadata,
    };

    if (this.config.format === 'json') {
      this.outputJson(entry);
    } else {
      this.outputPretty(entry);
    }
  }

  /**
   * Log debug message
   */
  async debug(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('info' as any, message, metadata);
  }

  /**
   * Log info message
   */
  async info(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('info', message, metadata);
  }

  /**
   * Log warning message
   */
  async warn(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('warn', message, metadata);
  }

  /**
   * Log error message
   */
  async error(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('error', message, metadata);
  }

  /**
   * Record a metric
   */
  async metric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    this.ensureInitialized();

    if (!this.config.enableMetrics) {
      return;
    }

    const entry: MetricEntry = {
      timestamp: new Date().toISOString(),
      name,
      value,
      type: 'gauge',
      labels,
    };

    // Store metric
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(entry);

    // Output metric
    if (this.config.format === 'json') {
      this.outputJson({ type: 'metric', ...entry });
    } else {
      const labelsStr = Object.entries(labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      console.log(`[METRIC] ${name}=${value} ${labelsStr}`);
    }
  }

  /**
   * Increment a counter
   */
  async incrementCounter(name: string, labels: Record<string, string> = {}): Promise<void> {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + 1);
    await this.metric(name, current + 1, labels);
  }

  /**
   * Set a gauge value
   */
  async setGauge(name: string, value: number, labels: Record<string, string> = {}): Promise<void> {
    this.gauges.set(name, value);
    await this.metric(name, value, labels);
  }

  /**
   * Record a histogram value
   */
  async recordHistogram(name: string, value: number, labels: Record<string, string> = {}): Promise<void> {
    await this.metric(name, value, { ...labels, _type: 'histogram' });
  }

  /**
   * Start a trace span
   */
  startSpan(name: string, parentSpanId?: string): string {
    if (!this.config.enableTracing) {
      return '';
    }

    const traceId = parentSpanId
      ? this.activeSpans.get(parentSpanId)?.traceId || this.generateId()
      : this.generateId();
    const spanId = this.generateId();

    const span: SpanContext = {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      attributes: {},
      events: [],
    };

    this.activeSpans.set(spanId, span);
    return spanId;
  }

  /**
   * End a trace span
   */
  endSpan(spanId: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = Date.now();
    const duration = span.endTime - span.startTime;

    // Output span
    if (this.config.format === 'json') {
      this.outputJson({
        type: 'trace',
        ...span,
        durationMs: duration,
      });
    } else {
      console.log(
        `[TRACE] ${span.name} (${duration}ms) traceId=${span.traceId} spanId=${span.spanId}`
      );
    }

    // Remove from active spans
    this.activeSpans.delete(spanId);
  }

  /**
   * Add attribute to span
   */
  addSpanAttribute(spanId: string, key: string, value: unknown): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.attributes[key] = value;
    }
  }

  /**
   * Add event to span
   */
  addSpanEvent(spanId: string, name: string): void {
    const span = this.activeSpans.get(spanId);
    if (span) {
      span.events.push({ name, timestamp: Date.now() });
    }
  }

  /**
   * Trace a function execution
   */
  async trace<T>(spanName: string, fn: () => Promise<T>): Promise<T> {
    const spanId = this.startSpan(spanName);
    
    try {
      const result = await fn();
      this.endSpan(spanId);
      return result;
    } catch (error) {
      this.addSpanAttribute(spanId, 'error', true);
      this.addSpanAttribute(spanId, 'errorMessage', error instanceof Error ? error.message : 'Unknown error');
      this.endSpan(spanId);
      throw error;
    }
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): Map<string, MetricEntry[]> {
    return new Map(this.metrics);
  }

  /**
   * Get metric statistics
   */
  getMetricStats(name: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    sum: number;
  } | null {
    const entries = this.metrics.get(name);
    if (!entries || entries.length === 0) {
      return null;
    }

    const values = entries.map(e => e.value);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      sum,
    };
  }

  /**
   * Get active spans
   */
  getActiveSpans(): SpanContext[] {
    return Array.from(this.activeSpans.values());
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
  }

  /**
   * Shutdown the provider
   */
  async shutdown(): Promise<void> {
    // End all active spans
    for (const spanId of this.activeSpans.keys()) {
      this.endSpan(spanId);
    }

    this.initialized = false;
  }

  /**
   * Output as JSON
   */
  private outputJson(data: unknown): void {
    console.log(JSON.stringify(data));
  }

  /**
   * Output in pretty format
   */
  private outputPretty(entry: LogEntry): void {
    const colors = this.config.colorize
      ? {
          debug: '\x1b[36m', // cyan
          info: '\x1b[32m', // green
          warn: '\x1b[33m', // yellow
          error: '\x1b[31m', // red
          reset: '\x1b[0m',
        }
      : { debug: '', info: '', warn: '', error: '', reset: '' };

    const levelColor = colors[entry.level] || '';
    const timestamp = this.config.includeTimestamp ? `[${entry.timestamp}] ` : '';
    const service = entry.service ? `[${entry.service}] ` : '';
    const metadata = entry.metadata ? ` ${JSON.stringify(entry.metadata)}` : '';

    console.log(
      `${timestamp}${levelColor}[${entry.level.toUpperCase()}]${colors.reset} ${service}${entry.message}${metadata}`
    );
  }

  /**
   * Generate random ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 18);
  }

  /**
   * Ensure provider is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('Observability provider not initialized. Call initialize() first.');
    }
  }
}

/**
 * Export provider instance for easy registration
 */
export function createConsoleObservabilityProvider(
  config?: ConsoleObservabilityConfig
): ConsoleObservabilityProvider {
  return new ConsoleObservabilityProvider(config);
}

/**
 * Default export
 */
export default ConsoleObservabilityProvider;