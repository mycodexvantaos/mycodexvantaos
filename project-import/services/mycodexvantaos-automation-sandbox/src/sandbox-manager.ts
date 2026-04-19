import { randomInt } from 'node:crypto';
import type { Sandbox, ResourceLimits, ResourceUsage } from "./types";

let counter = 0;

const DEFAULT_LIMITS: ResourceLimits = {
  cpuCores: 2,
  memoryMB: 2048,
  diskMB: 10240,
  networkBandwidth: "100Mbps",
};

export class SandboxManagerService {
  private sandboxes = new Map<string, Sandbox>();

  create(name: string, image: string, limits?: Partial<ResourceLimits>): Sandbox {
    const id = `sbx-${++counter}`;
    const sandbox: Sandbox = {
      id,
      name,
      status: "creating",
      image,
      createdAt: new Date(),
      resources: { ...DEFAULT_LIMITS, ...limits },
    };
    this.sandboxes.set(id, sandbox);
    sandbox.status = "running";
    return sandbox;
  }

  get(sandboxId: string): Sandbox | null {
    return this.sandboxes.get(sandboxId) ?? null;
  }

  list(): Sandbox[] {
    return Array.from(this.sandboxes.values());
  }

  listByStatus(status: Sandbox["status"]): Sandbox[] {
    return this.list().filter((s) => s.status === status);
  }

  pause(sandboxId: string): boolean {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx || sbx.status !== "running") return false;
    sbx.status = "paused";
    return true;
  }

  resume(sandboxId: string): boolean {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx || sbx.status !== "paused") return false;
    sbx.status = "running";
    return true;
  }

  terminate(sandboxId: string): boolean {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx || sbx.status === "terminated") return false;
    sbx.status = "terminated";
    return true;
  }

  getUsage(sandboxId: string): ResourceUsage | null {
    const sbx = this.sandboxes.get(sandboxId);
    if (!sbx || sbx.status !== "running") return null;
    return {
      cpuPercent: randomInt(5, 86),
      memoryUsedMB: Math.round(sbx.resources.memoryMB * 0.4),
      diskUsedMB: Math.round(sbx.resources.diskMB * 0.2),
      networkIO: { rx: 1024, tx: 512 },
    };
  }

  destroy(sandboxId: string): boolean {
    return this.sandboxes.delete(sandboxId);
  }
}