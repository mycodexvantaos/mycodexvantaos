/**
 * Logger System - Provider Pattern Version
 * Transformed to use LoggingCapability for platform independence
 */

import type { LoggingCapability, LogEntry, LogLevel as CapabilityLogLevel } from '../packages/capabilities/src/logging';

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogEntryLegacy {
  timestamp: number;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: Error;
}

/**
 * Logger using Provider Pattern
 */
export class LoggerProvider {
  private logging: LoggingCapability | null = null;
  private localLogs: LogEntryLegacy[] = [];
  private maxLogs = 500;
  private initialized = false;

  constructor(private providerFactory?: any) {}

  /**
   * Initialize the logger
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (this.providerFactory) {
        this.logging = await this.providerFactory.getLoggingProvider();
        await this.logging.initialize();
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Logger:', error);
      // Continue with local logging only
      this.initialized = true;
    }
  }

  /**
   * Record a log entry
   */
  private async log(
    level: LogLevel,
    message: string,
    context?: Record<string, any>,
    error?: Error
  ): Promise<void> {
    const entry: LogEntryLegacy = {
      timestamp: Date.now(),
      level,
      message,
      context,
      error,
    };

    // Always store locally
    this.localLogs.push(entry);
    if (this.localLogs.length > this.maxLogs) {
      this.localLogs = this.localLogs.slice(-this.maxLogs);
    }

    // Console output
    const consoleMethod = {
      [LogLevel.DEBUG]: console.debug,
      [LogLevel.INFO]: console.log,
      [LogLevel.WARN]: console.warn,
      [LogLevel.ERROR]: console.error,
    }[level];

    const logMessage = `[${entry.timestamp}] [${level}] ${message}`;
    if (context) {
      consoleMethod(logMessage, context);
    } else {
      consoleMethod(logMessage);
    }

    if (error) {
      consoleMethod('Error details:', error);
    }

    // Also send to capability if available
    if (this.logging) {
      try {
        await this.logging.log({
          level: this.mapLogLevel(level),
          message,
          context,
          error: error?.message,
        });
      } catch {
        // Ignore capability errors, local log already stored
      }
    }
  }

  /**
   * Map log level to capability format
   */
  private mapLogLevel(level: LogLevel): CapabilityLogLevel {
    const map: Record<LogLevel, CapabilityLogLevel> = {
      [LogLevel.DEBUG]: 'debug',
      [LogLevel.INFO]: 'info',
      [LogLevel.WARN]: 'warn',
      [LogLevel.ERROR]: 'error',
    };
    return map[level];
  }

  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  /**
   * Get all logs
   */
  getLogs(): LogEntryLegacy[] {
    return [...this.localLogs];
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: LogLevel): LogEntryLegacy[] {
    return this.localLogs.filter((log) => log.level === level);
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.localLogs = [];
  }

  /**
   * Export logs as text
   */
  exportAsText(): string {
    return this.localLogs
      .map((log) => {
        const date = new Date(log.timestamp).toISOString();
        let text = `[${date}] [${log.level}] ${log.message}`;
        if (log.context) {
          text += `\n  Context: ${JSON.stringify(log.context, null, 2)}`;
        }
        if (log.error) {
          text += `\n  Error: ${log.error.message}\n  Stack: ${log.error.stack}`;
        }
        return text;
      })
      .join('\n\n');
  }

  /**
   * Export logs as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify(this.localLogs, null, 2);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.logging) return true; // Local logger is always healthy
    
    try {
      const result = await this.logging.healthCheck();
      return result.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.logging) {
      await this.logging.shutdown();
    }
    this.initialized = false;
  }
}

// Singleton instance
let _loggerInstance: LoggerProvider | null = null;

/**
 * Get the logger instance
 */
export async function getLogger(): Promise<LoggerProvider> {
  if (!_loggerInstance) {
    _loggerInstance = new LoggerProvider();
    await _loggerInstance.initialize();
  }
  return _loggerInstance;
}

/**
 * Create a new logger with provider factory
 */
export async function createLogger(providerFactory?: any): Promise<LoggerProvider> {
  const logger = new LoggerProvider(providerFactory);
  await logger.initialize();
  return logger;
}

/**
 * Default export for backward compatibility
 * Note: This is a synchronous singleton that works without initialization
 */
export const logger = new LoggerProvider();