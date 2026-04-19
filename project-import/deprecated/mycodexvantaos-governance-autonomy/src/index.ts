import pino from "pino";

const logger = pino({ name: "governance-autonomy" });

export * from "./types";
export { ComplianceService } from "./compliance";
export { RemediationService } from "./remediation";

export async function bootstrap(): Promise<void> {
  logger.info("governance-autonomy initialized");
}