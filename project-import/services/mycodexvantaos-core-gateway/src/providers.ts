export interface ProviderHealth {
  healthy: boolean;
  mode: string;
}

export interface ProviderRegistry {
  database: { healthcheck(): Promise<ProviderHealth> };
  stateStore: { healthcheck(): Promise<ProviderHealth> };
  observability: { healthcheck(): Promise<ProviderHealth> };
  queue: { healthcheck(): Promise<ProviderHealth> };
  secrets: { healthcheck(): Promise<ProviderHealth> };
}

export function createNativeProviders(): ProviderRegistry {
  const nativeHealth = async (): Promise<ProviderHealth> => ({
    healthy: true,
    mode: "native",
  });
  return {
    database: { healthcheck: nativeHealth },
    stateStore: { healthcheck: nativeHealth },
    observability: { healthcheck: nativeHealth },
    queue: { healthcheck: nativeHealth },
    secrets: { healthcheck: nativeHealth },
  };
}
