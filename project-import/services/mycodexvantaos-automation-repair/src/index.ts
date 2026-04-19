import pino from "pino";

const logger = pino({ name: "automation-core" });

export * from "./types";
export { WorkflowEngineService } from "./workflow-engine";
export { StateMachineService } from "./state-machine";

export async function bootstrap(): Promise<void> {
  logger.info("automation-core initialized");
}