/**
 * ProviderRegistry — central runtime capability manager
 *
 * Determines which providers are available and wires them
 * into the platform's service layer.
 */
import pino from "pino";

const logger = pino({ name: "provider-registry" });

export type ProviderCapability =
  | "database"
  | "storage"
  | "auth"
  | "queue"
  | "stateStore"
  | "secrets"
  | "repo"
  | "deploy"
  | "validation"
  | "security"
  | "observability"
  | "notification";

export interface Provider {
  name: string;
  capability: ProviderCapability;
  initialize(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

export class ProviderRegistry {
  private providers = new Map<ProviderCapability, Provider>();

  async initialize(): Promise<void> {
    logger.info(
      { capabilities: Array.from(this.providers.keys()) },
      "ProviderRegistry initialized"
    );
  }

  register(provider: Provider): void {
    this.providers.set(provider.capability, provider);
    logger.debug({ capability: provider.capability, name: provider.name }, "Provider registered");
  }

  resolve<T extends Provider>(capability: ProviderCapability): T {
    const provider = this.providers.get(capability);
    if (!provider) {
      throw new Error(`No provider registered for capability: ${capability}`);
    }
    return provider as T;
  }

  has(capability: ProviderCapability): boolean {
    return this.providers.has(capability);
  }

  list(): ProviderCapability[] {
    return Array.from(this.providers.keys());
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [cap, provider] of this.providers) {
      try {
        results[cap] = await provider.healthCheck();
      } catch {
        results[cap] = false;
      }
    }
    return results;
  }
}
