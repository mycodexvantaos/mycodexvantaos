/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface LogEntry { level: "debug" | "info" | "warn" | "error" | "fatal"; message: string; timestamp: Date; context: Record<string, unknown>; source: string; }

export interface MetricResult { name: string; value: number; timestamp: Date; tags: Record<string, string>; }

export interface Span { id: string; traceId: string; parentId?: string; name: string; startTime: Date; endTime?: Date; attributes: Record<string, unknown>; }

export interface Trace { id: string; spans: Span[]; duration: number; status: string; }

export interface AlertRule { id: string; name: string; condition: string; severity: "low" | "medium" | "high" | "critical"; enabled: boolean; }
