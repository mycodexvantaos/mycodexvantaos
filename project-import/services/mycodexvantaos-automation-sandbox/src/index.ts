import pino from "pino";

const logger = pino({ name: "fleet-sandbox" });

export * from "./types";
export { SandboxManagerService } from "./sandbox-manager";

export async function bootstrap(): Promise<void> {
  logger.info("fleet-sandbox initialized");
}