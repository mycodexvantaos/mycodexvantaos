/**
 * CodexvantaOS — observability-stack / TracingService
 * Distributed tracing facade
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface SpanContext { traceId: string; spanId: string; parentSpanId?: string; }

export class TracingService {
  private defaultService: string;
  constructor(serviceName: string = 'codexvanta') { this.defaultService = serviceName; }
  private get providers() { return getProviders(); }

  startSpan(operationName: string, options?: { parentContext?: SpanContext; attributes?: Record<string, unknown> }): SpanContext {
    return this.providers.observability.startSpan(operationName, { parentContext: options?.parentContext, service: this.defaultService, attributes: options?.attributes });
  }

  endSpan(spanId: string, status: 'ok' | 'error' = 'ok', errorMessage?: string): void { this.providers.observability.endSpan(spanId, status, errorMessage); }
  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void { this.providers.observability.addSpanEvent(spanId, { name, timestamp: Date.now(), attributes }); }
  setAttributes(spanId: string, attributes: Record<string, unknown>): void { this.providers.observability.setSpanAttributes(spanId, attributes); }

  async withSpan<T>(operationName: string, fn: (ctx: SpanContext) => Promise<T>, options?: { parentContext?: SpanContext }): Promise<T> {
    const ctx = this.startSpan(operationName, options);
    try { const result = await fn(ctx); this.endSpan(ctx.spanId, 'ok'); return result; }
    catch (err) { this.endSpan(ctx.spanId, 'error', String(err)); throw err; }
  }

  async queryTraces(options: { traceId?: string; service?: string; since?: number; limit?: number }): Promise<any[]> { return this.providers.observability.queryTraces(options); }
  child(serviceName: string): TracingService { return new TracingService(serviceName); }
}
