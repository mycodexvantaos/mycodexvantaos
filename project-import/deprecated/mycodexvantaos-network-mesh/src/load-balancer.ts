import { randomInt } from 'node:crypto';
import type { ServiceInstance } from "./types";

export type BalancingStrategy = "round-robin" | "random" | "least-connections";

interface ConnectionCount {
  instanceId: string;
  count: number;
}

export class LoadBalancerService {
  private strategy: BalancingStrategy = "round-robin";
  private rrIndex = 0;
  private connections = new Map<string, number>();

  setStrategy(strategy: BalancingStrategy): void {
    this.strategy = strategy;
    this.rrIndex = 0;
  }

  getStrategy(): BalancingStrategy {
    return this.strategy;
  }

  select(instances: ServiceInstance[]): ServiceInstance | null {
    const healthy = instances.filter((i) => i.healthy);
    if (healthy.length === 0) return null;

    switch (this.strategy) {
      case "round-robin":
        return this.roundRobin(healthy);
      case "random":
        return this.randomSelect(healthy);
      case "least-connections":
        return this.leastConnections(healthy);
      default:
        return healthy[0];
    }
  }

  recordConnection(instanceId: string): void {
    this.connections.set(
      instanceId,
      (this.connections.get(instanceId) ?? 0) + 1,
    );
  }

  releaseConnection(instanceId: string): void {
    const current = this.connections.get(instanceId) ?? 0;
    if (current > 0) {
      this.connections.set(instanceId, current - 1);
    }
  }

  getConnectionCounts(): ConnectionCount[] {
    return Array.from(this.connections.entries()).map(([instanceId, count]) => ({
      instanceId,
      count,
    }));
  }

  private roundRobin(instances: ServiceInstance[]): ServiceInstance {
    const idx = this.rrIndex % instances.length;
    this.rrIndex++;
    return instances[idx];
  }

  private randomSelect(instances: ServiceInstance[]): ServiceInstance {
    const idx = randomInt(instances.length);
    return instances[idx];
  }

  private leastConnections(instances: ServiceInstance[]): ServiceInstance {
    let min = Infinity;
    let selected = instances[0];
    for (const inst of instances) {
      const count = this.connections.get(inst.id) ?? 0;
      if (count < min) {
        min = count;
        selected = inst;
      }
    }
    return selected;
  }
}