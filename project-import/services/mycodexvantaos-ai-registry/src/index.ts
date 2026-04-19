/**
 * CodexvantaOS — module-suite
 * 模組套件 — 模組載入、插件管理
 */

import pino from "pino";

const logger = pino({ name: "module-suite" });

export * from "./types";
export { ModuleLoaderService } from "./module-loader";
export { PluginManagerService } from "./plugin-manager";

export async function bootstrap(): Promise<void> {
  logger.info("module-suite initialized");
}