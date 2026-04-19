/**
 * CodexvantaOS — secret-vault
 * 密鑰金庫 — 密鑰管理、加密、輪替
 */

import pino from "pino";

const logger = pino({ name: "secret-vault" });

// Re-export types
export * from "./types";

// Re-export services
export { VaultService } from "./vault";
export { EncryptionService } from "./encryption";

/**
 * Bootstrap secret-vault module
 */
export async function bootstrap(): Promise<void> {
  logger.info("secret-vault initialized");
}