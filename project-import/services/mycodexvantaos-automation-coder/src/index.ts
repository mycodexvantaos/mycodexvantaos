import pino from "pino";

const logger = pino({ name: "core-code-deconstructor" });

export * from "./types";
export { ParserService } from "./parser";
export { AnalyzerService } from "./analyzer";

export async function bootstrap(): Promise<void> {
  logger.info("core-code-deconstructor initialized");
}