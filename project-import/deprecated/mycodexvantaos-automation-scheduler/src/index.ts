/**
 * CodexvantaOS — scheduler
 * 排程器 — 任務排程、Cron、延遲執行
 */

import pino from "pino";

const logger = pino({ name: "scheduler" });

// Re-export types
export * from "./types";

// Re-export services
export { SchedulerService } from "./scheduler";
export { CronService } from "./cron";

/**
 * Bootstrap scheduler module
 */
export async function bootstrap(): Promise<void> {
  logger.info("scheduler initialized");
}