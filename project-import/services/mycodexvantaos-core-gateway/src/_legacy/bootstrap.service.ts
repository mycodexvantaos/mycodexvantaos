import { createNativeProviders, ProviderRegistry } from "../providers";

export interface HealthStatus {
  mode: string;
  providers: Record<string, { healthy: boolean; mode: string }>;
}

export class BootstrapOrchestratorService {
  private providers: ProviderRegistry;

  constructor() {
    this.providers = createNativeProviders();
  }

  async bootstrap(): Promise<void> {
    const checks = [
      { name: "database", check: () => this.providers.database.healthcheck() },
      { name: "stateStore", check: () => this.providers.stateStore.healthcheck() },
      { name: "observability", check: () => this.providers.observability.healthcheck() },
      { name: "queue", check: () => this.providers.queue.healthcheck() },
      { name: "secrets", check: () => this.providers.secrets.healthcheck() },
    ];
    for (const { name, check } of checks) {
      const result = await check();
      if (!result.healthy) {
        throw new Error("Provider " + name + " is unhealthy");
      }
    }
  }

  async shutdown(): Promise<void> {
    // Graceful shutdown logic
  }

  async healthCheck(): Promise<HealthStatus> {
    const providerHealth: Record<string, { healthy: boolean; mode: string }> = {};
    const checks = [
      { name: "database", check: () => this.providers.database.healthcheck() },
      { name: "stateStore", check: () => this.providers.stateStore.healthcheck() },
      { name: "observability", check: () => this.providers.observability.healthcheck() },
      { name: "queue", check: () => this.providers.queue.healthcheck() },
      { name: "secrets", check: () => this.providers.secrets.healthcheck() },
    ];
    for (const { name, check } of checks) {
      const result = await check();
      providerHealth[name] = { healthy: result.healthy, mode: result.mode };
    }
    return {
      mode: this.detectMode(providerHealth),
      providers: providerHealth,
    };
  }

  private detectMode(health: Record<string, { mode: string }>): string {
    const modes = new Set(Object.values(health).map((h) => h.mode));
    if (modes.has("native") && modes.has("external")) return "hybrid";
    if (modes.has("external")) return "external";
    return "native";
  }
}
