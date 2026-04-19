import { Command } from "commander";
import { registerConfigCommand } from "./commands/config";
import { registerDeployCommand } from "./commands/deploy";
import { registerInitCommand } from "./commands/init";
import { registerScanCommand } from "./commands/scan";
import { registerStatusCommand } from "./commands/status";

export function createCli(): Command {
  const program = new Command();

  program
    .name("codexvanta")
    .description("CodexvantaOS CLI")
    .version("0.1.0");

  registerInitCommand(program);
  registerConfigCommand(program);
  registerDeployCommand(program);
  registerScanCommand(program);
  registerStatusCommand(program);

  return program;
}
