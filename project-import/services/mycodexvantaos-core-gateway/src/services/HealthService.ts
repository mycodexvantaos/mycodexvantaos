import type { Startable } from "../lifecycle";

export interface HealthStatus {
  status: "healthy" | "unhealthy";
  uptime: number;
  timestamp: string;
}

export class HealthService implements Startable {
  private startTime = 0;

  async start(): Promise<void> {
    this.startTime = Date.now();
  }

  async stop(): Promise<void> {
    this.startTime = 0;
  }

  check(): HealthStatus {
    return {
      status: this.startTime > 0 ? "healthy" : "unhealthy",
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      timestamp: new Date().toISOString()
    };
  }
}
