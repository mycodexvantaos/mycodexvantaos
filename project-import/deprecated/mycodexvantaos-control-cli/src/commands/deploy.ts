import type { Command } from "commander";

export function registerDeployCommand(program: Command): void {
  program
    .command("deploy")
    .description("Deploy services")
    .option("-e, --env <environment>", "Target environment", "development")
    .action((opts) => {
      console.log("Deploying to:", opts.env);
    });
}
