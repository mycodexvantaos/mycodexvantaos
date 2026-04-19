import type { Command } from "commander";
import { getConfigPath, loadConfig, saveConfig } from "../utils/config";

export function registerConfigCommand(program: Command): void {
  const cmd = program.command("config").description("Manage CLI configuration");

  cmd.command("show").action(() => {
    console.log(JSON.stringify(loadConfig(), null, 2));
  });

  cmd.command("path").action(() => {
    console.log(getConfigPath());
  });

  cmd.command("set <key> <value>").action((key: string, value: string) => {
    const current = loadConfig();
    current[key] = value;
    saveConfig(current);
    console.log("Config updated");
  });
}
