import pino from "pino";
import { LifecycleManager } from "./lifecycle";
import { HealthService } from "./services/HealthService";
import { RuntimeService } from "./services/RuntimeService";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

export interface BootstrapOptions {
  port?: number;
}

export async function bootstrap(opts: BootstrapOptions = {}): Promise<void> {
  const port = opts.port ?? (Number(process.env.PORT) || 3000);
  logger.info({ port }, "CodexvantaOS core-main starting");

  const lifecycle = new LifecycleManager(logger);
  lifecycle.register("health", new HealthService());
  lifecycle.register("runtime", new RuntimeService());

  await lifecycle.startAll();
  logger.info("All services started");
}

if (require.main === module) {
  bootstrap().catch((err) => {
    console.error("Fatal bootstrap error:", err);
    process.exit(1);
  });
}
