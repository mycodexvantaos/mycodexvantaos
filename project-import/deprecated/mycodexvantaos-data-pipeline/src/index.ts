/**
 * CodexvantaOS — data-pipeline
 * 資料管線 — 資料擷取、轉換、匯出
 */

import pino from "pino";

const logger = pino({ name: "data-pipeline" });

export * from "./types";
export { IngestionService } from "./ingestion";
export { TransformationService } from "./transformation";
export { ExportService } from "./export";

export async function bootstrap(): Promise<void> {
  logger.info("data-pipeline initialized");
}