import type { Startable } from "../lifecycle";

export interface RuntimeInfo {
  nodeVersion: string;
  platform: string;
  pid: number;
}

export class RuntimeService implements Startable {
  private running = false;

  async start(): Promise<void> {
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
  }

  info(): RuntimeInfo {
    return {
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid
    };
  }

  isRunning(): boolean {
    return this.running;
  }
}
