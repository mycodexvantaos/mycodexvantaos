import pino from "pino";

const logger = pino({ name: "workflows" });

export * from "./types";
export { PipelineService } from "./pipeline";
export { TriggerService } from "./trigger";

export async function bootstrap(): Promise<void> {
  logger.info("workflows initialized");
}