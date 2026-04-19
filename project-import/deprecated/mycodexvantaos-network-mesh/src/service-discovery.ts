import type { ServiceInstance } from "./types";

let counter = 0;

export class ServiceDiscoveryService {
  private instances = new Map<string, ServiceInstance>();

  register(
    input: Omit<ServiceInstance, "id" | "healthy">,
  ): ServiceInstance {
    const id = `svc-${++counter}`;
    const instance: ServiceInstance = { id, healthy: true, ...input };
    this.instances.set(id, instance);
    return instance;
  }

  deregister(instanceId: string): boolean {
    return this.instances.delete(instanceId);
  }

  getInstance(instanceId: string): ServiceInstance | null {
    return this.instances.get(instanceId) ?? null;
  }

  discover(serviceName: string): ServiceInstance[] {
    return Array.from(this.instances.values()).filter(
      (i) => i.name === serviceName && i.healthy,
    );
  }

  listAll(): ServiceInstance[] {
    return Array.from(this.instances.values());
  }

  markHealthy(instanceId: string): boolean {
    const inst = this.instances.get(instanceId);
    if (!inst) return false;
    inst.healthy = true;
    return true;
  }

  markUnhealthy(instanceId: string): boolean {
    const inst = this.instances.get(instanceId);
    if (!inst) return false;
    inst.healthy = false;
    return true;
  }

  healthCheck(): { total: number; healthy: number; unhealthy: number } {
    const all = Array.from(this.instances.values());
    const healthy = all.filter((i) => i.healthy).length;
    return { total: all.length, healthy, unhealthy: all.length - healthy };
  }
}