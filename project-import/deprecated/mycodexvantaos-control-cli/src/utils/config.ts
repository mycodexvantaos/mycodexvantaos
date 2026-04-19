import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type CliConfig = Record<string, unknown>;

export function getConfigDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || "~";
  return join(home, ".codexvanta");
}

export function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

export function loadConfig(): CliConfig {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, "utf-8")) as CliConfig;
}

export function saveConfig(config: CliConfig): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}
