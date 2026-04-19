/**
 * CodexvantaOS — observability-stack
 * 可觀測性堆疊 — 日誌、指標、追蹤、告警
 */

import pino from "pino";

const logger = pino({ name: "observability-stack" });

// Re-export types
export * from "./types";

// Re-export services
export { LoggingService } from "./logging";
export { MetricsService } from "./metrics";
export { TracingService } from "./tracing";
export { AlertingService } from "./alerting";

/**
 * Bootstrap observability-stack module
 */
export async function bootstrap(): Promise<void> {
  logger.info("observability-stack initialized");
}