/**
 * CodexvantaOS — infra-base / ProvisioningService
 * In-memory infrastructure resource provisioning
 */

import type { ProvisionResult } from "./types";

export type ResourceType = "database" | "storage" | "queue" | "cache" | "compute" | "network";
export type ResourceStatus = "provisioning" | "ready" | "degraded" | "destroying" | "destroyed" | "error";

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  status: ResourceStatus;
  config: Record<string, unknown>;
  endpoints: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export class ProvisioningService {
  private resources = new Map<string, Resource>();

  async provision(request: {
    name: string;
    type: ResourceType;
    config?: Record<string, unknown>;
  }): Promise<ProvisionResult> {
    const id = `res-${request.type}-${Date.now()}`;
    const endpoints = this.generateEndpoints(request.type);
    const resource: Resource = {
      id,
      name: request.name,
      type: request.type,
      status: "ready",
      config: request.config ?? {},
      endpoints,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.resources.set(id, resource);
    return {
      environmentId: id,
      status: "ready",
      endpoints,
      createdAt: new Date(resource.createdAt),
    };
  }

  async destroy(resourceId: string): Promise<void> {
    const resource = this.resources.get(resourceId);
    if (!resource) throw new Error(`Resource not found: ${resourceId}`);
    resource.status = "destroyed";
    resource.updatedAt = Date.now();
  }

  async getResource(resourceId: string): Promise<Resource | null> {
    return this.resources.get(resourceId) ?? null;
  }

  async listResources(filter?: { type?: ResourceType; status?: ResourceStatus }): Promise<Resource[]> {
    let resources = Array.from(this.resources.values());
    if (filter?.type) resources = resources.filter((r) => r.type === filter.type);
    if (filter?.status) resources = resources.filter((r) => r.status === filter.status);
    return resources;
  }

  async getStatus(): Promise<{ total: number; ready: number; degraded: number }> {
    const all = Array.from(this.resources.values());
    return {
      total: all.length,
      ready: all.filter((r) => r.status === "ready").length,
      degraded: all.filter((r) => r.status === "degraded").length,
    };
  }

  private generateEndpoints(type: ResourceType): Record<string, string> {
    switch (type) {
      case "database": return { primary: "sqlite:///data/platform.db" };
      case "storage": return { local: "file:///data/storage" };
      case "queue": return { internal: "memory://queue" };
      default: return {};
    }
  }
}