import pino from "pino";

export function createLogger(level?: string): pino.Logger {
  return pino({ level: level || process.env.LOG_LEVEL || "info" });
}
