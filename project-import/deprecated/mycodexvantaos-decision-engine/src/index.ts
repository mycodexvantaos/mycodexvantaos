/**
 * CodexvantaOS — decision-engine
 * 決策引擎 — 規則引擎、路由
 */

import pino from "pino";

const logger = pino({ name: "decision-engine" });

export * from "./types";
export { RuleEngineService } from "./rule-engine";
export { RoutingService } from "./routing";

export async function bootstrap(): Promise<void> {
  logger.info("decision-engine initialized");
}