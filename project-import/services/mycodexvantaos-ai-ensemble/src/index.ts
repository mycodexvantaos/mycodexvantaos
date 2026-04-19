import pino from "pino";

const logger = pino({ name: "ai-engine" });

export * from "./types";
export { ModelRegistryService } from "./model-registry";
export { AgentService } from "./agent";

export async function bootstrap(): Promise<void> {
  logger.info("ai-engine initialized");
}