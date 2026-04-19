import type { Command } from "commander";

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan project")
    .action(() => {
      console.log("Scanning project...");
    });
}
