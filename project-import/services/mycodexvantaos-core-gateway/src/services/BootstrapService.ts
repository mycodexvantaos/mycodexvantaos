import type { Startable } from "../lifecycle";

export class BootstrapService implements Startable {
  private initialized = false;

  async start(): Promise<void> {
    this.initialized = true;
  }

  async stop(): Promise<void> {
    this.initialized = false;
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}
