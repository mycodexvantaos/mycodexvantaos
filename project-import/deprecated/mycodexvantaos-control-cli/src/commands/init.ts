import type { Command } from "commander";

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize a new CodexvantaOS project")
    .option("-d, --dir <path>", "Target directory", ".")
    .action((opts) => {
      console.log("Initializing project in:", opts.dir);
    });
}
