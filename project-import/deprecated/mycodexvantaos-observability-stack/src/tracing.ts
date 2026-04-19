/**
 * CodexvantaOS — observability-stack / TracingService
 * In-memory distributed tracing
 */

import type { Span, Trace } from "./types";
import * as crypto from "crypto";

export class TracingService {
  private spans = new Map<string, Span>();
  private serviceName: string;

  constructor(serviceName = "codexvanta") {
    this.serviceName = serviceName;
  }

  startSpan(operationName: string, options?: {
    parentContext?: { traceId: string; spanId: string };
    attributes?: Record<string, unknown>;
  }): Span {
    const span: Span = {
      id: crypto.randomUUID(),
      traceId: options?.parentContext?.traceId ?? crypto.randomUUID(),
      parentId: options?.parentContext?.spanId,
      name: operationName,
      startTime: new Date(),
      attributes: { service: this.serviceName, ...options?.attributes },
    };
    this.spans.set(span.id, span);
    return span;
  }

  endSpan(spanId: string, status: "ok" | "error" = "ok", errorMessage?: string): void {
    const span = this.spans.get(spanId);
    if (!span) return;
    span.endTime = new Date();
    span.attributes["status"] = status;
    if (errorMessage) span.attributes["error"] = errorMessage;
  }

  getSpan(spanId: string): Span | null {
    return this.spans.get(spanId) ?? null;
  }

  getTrace(traceId: string): Trace | null {
    const traceSpans = Array.from(this.spans.values()).filter((s) => s.traceId === traceId);
    if (traceSpans.length === 0) return null;
    const first = traceSpans.reduce((a, b) => (a.startTime < b.startTime ? a : b));
    const last = traceSpans.reduce((a, b) => {
      const aEnd = a.endTime ?? a.startTime;
      const bEnd = b.endTime ?? b.startTime;
      return aEnd > bEnd ? a : b;
    });
    const endTime = last.endTime ?? last.startTime;
    return {
      id: traceId,
      spans: traceSpans,
      duration: endTime.getTime() - first.startTime.getTime(),
      status: traceSpans.every((s) => s.attributes["status"] !== "error") ? "ok" : "error",
    };
  }

  listTraces(options?: { limit?: number }): Trace[] {
    const traceIds = new Set<string>();
    for (const span of this.spans.values()) traceIds.add(span.traceId);
    const traces: Trace[] = [];
    for (const tid of traceIds) {
      const t = this.getTrace(tid);
      if (t) traces.push(t);
    }
    if (options?.limit) return traces.slice(0, options.limit);
    return traces;
  }

  async withSpan<T>(operationName: string, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = this.startSpan(operationName);
    try {
      const result = await fn(span);
      this.endSpan(span.id, "ok");
      return result;
    } catch (err) {
      this.endSpan(span.id, "error", String(err));
      throw err;
    }
  }

  child(serviceName: string): TracingService {
    return new TracingService(serviceName);
  }
}