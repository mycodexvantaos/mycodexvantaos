/**
 * CodexvantaOS — observability-stack / LoggingService
 * Structured logging facade over ObservabilityProvider
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export class LoggingService {
  private defaultService: string;
  constructor(serviceName: string = 'codexvanta') { this.defaultService = serviceName; }
  private get providers() { return getProviders(); }

  trace(message: string, context?: Record<string, unknown>): void { this.log('trace', message, context); }
  debug(message: string, context?: Record<string, unknown>): void { this.log('debug', message, context); }
  info(message: string, context?: Record<string, unknown>): void { this.log('info', message, context); }
  warn(message: string, context?: Record<string, unknown>): void { this.log('warn', message, context); }
  error(message: string, context?: Record<string, unknown>): void { this.log('error', message, context); }
  fatal(message: string, context?: Record<string, unknown>): void { this.log('fatal', message, context); }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.providers.observability.log({ timestamp: Date.now(), level, message, service: this.defaultService, context });
  }

  async query(options: { service?: string; level?: LogLevel; since?: number; limit?: number }): Promise<any[]> {
    return this.providers.observability.queryLogs(options);
  }

  child(serviceName: string): LoggingService { return new LoggingService(serviceName); }
}
