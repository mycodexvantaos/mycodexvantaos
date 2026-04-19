import type { Logger } from "pino";

export interface Startable {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class LifecycleManager {
  private services = new Map<string, Startable>();
  private started: string[] = [];

  constructor(private logger: Logger) {}

  register(name: string, service: Startable): void {
    this.services.set(name, service);
  }

  async startAll(): Promise<void> {
    for (const [name, service] of this.services) {
      this.logger.info({ service: name }, "Starting service");
      await service.start();
      this.started.push(name);
    }
  }

  async stopAll(): Promise<void> {
    for (const name of [...this.started].reverse()) {
      const service = this.services.get(name);
      if (service) {
        this.logger.info({ service: name }, "Stopping service");
        await service.stop();
      }
    }
    this.started = [];
  }
}
