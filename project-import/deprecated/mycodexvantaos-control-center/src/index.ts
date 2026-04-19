import pino from "pino";

const logger = pino({ name: "control-center" });

export * from "./types";
export { OrchestrationService } from "./orchestration";
export { RegistryService } from "./registry";

export async function bootstrap(): Promise<void> {
  logger.info("control-center initialized");
}