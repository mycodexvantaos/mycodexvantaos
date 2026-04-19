/**
 * CodexvantaOS — observability-stack / LoggingService
 * In-memory structured logging
 */

import type { LogEntry } from "./types";

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3, fatal: 4,
};

export class LoggingService {
  private logs: LogEntry[] = [];
  private serviceName: string;
  private minLevel: LogLevel;

  constructor(serviceName = "codexvanta", minLevel: LogLevel = "debug") {
    this.serviceName = serviceName;
    this.minLevel = minLevel;
  }

  debug(message: string, context?: Record<string, unknown>): void { this.log("debug", message, context); }
  info(message: string, context?: Record<string, unknown>): void { this.log("info", message, context); }
  warn(message: string, context?: Record<string, unknown>): void { this.log("warn", message, context); }
  error(message: string, context?: Record<string, unknown>): void { this.log("error", message, context); }
  fatal(message: string, context?: Record<string, unknown>): void { this.log("fatal", message, context); }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;
    this.logs.push({
      level,
      message,
      timestamp: new Date(),
      context: context ?? {},
      source: this.serviceName,
    });
  }

  query(options?: { level?: LogLevel; source?: string; since?: Date; limit?: number }): LogEntry[] {
    let result = [...this.logs];
    if (options?.level) result = result.filter((l) => l.level === options.level);
    if (options?.source) result = result.filter((l) => l.source === options.source);
    if (options?.since) result = result.filter((l) => l.timestamp >= options.since!);
    if (options?.limit) result = result.slice(-options.limit);
    return result;
  }

  child(serviceName: string): LoggingService {
    return new LoggingService(serviceName, this.minLevel);
  }

  clear(): void { this.logs = []; }
}