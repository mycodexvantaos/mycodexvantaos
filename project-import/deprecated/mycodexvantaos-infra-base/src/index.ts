/**
 * CodexvantaOS — infra-base
 * 基礎設施層 — 環境佈建、基礎架構管理
 */

import pino from "pino";

const logger = pino({ name: "infra-base" });

// Re-export types
export * from "./types";

// Re-export services
export { ProvisioningService } from "./provisioning";
export { EnvironmentService } from "./environment";

/**
 * Bootstrap infra-base module
 */
export async function bootstrap(): Promise<void> {
  logger.info("infra-base initialized");
}