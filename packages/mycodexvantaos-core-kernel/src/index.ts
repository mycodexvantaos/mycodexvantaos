export interface ProviderManifest {
  capability: string;
  provider: string; // e.g., 'gemini', 'native', 'postgres'
  mode: 'native' | 'connected' | 'hybrid';
}

export interface BaseProvider {
  manifest: ProviderManifest;
  initialize(config?: any): Promise<void>;
  healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'down'; reason?: string }>;
  shutdown(): Promise<void>;
}

// -- Capabilities --
export interface LlmCompletionRequest { prompt: string; maxTokens?: number; }
export interface LlmCompletionResponse { content: string; providerUsed: string; }
export interface LlmProvider extends BaseProvider {
  generate(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}

export interface AuthProvider extends BaseProvider {
  verifyToken(token: string): Promise<boolean>;
}

export interface VectorStoreProvider extends BaseProvider {
  storeEmbedding(id: string, text: string, vector: number[]): Promise<boolean>;
  searchSimilar(vector: number[], topK?: number): Promise<any[]>;
}

export interface ObservabilityProvider extends BaseProvider {
  log(level: 'info'|'warn'|'error', message: string, context?: any): void;
  publishMetrics(executionId: string, metrics: any): Promise<void>;
}

/** Dynamic Service Locator & Provider Registry */
export class ProviderRegistry {
  private providers: Map<string, BaseProvider> = new Map();
  private defaultCapabilityMap: Map<string, string> = new Map();

  constructor(private readonly globalMode: 'native' | 'hybrid' | 'connected' | 'auto') {}

  register(provider: BaseProvider) {
    const { capability, provider: providerName } = provider.manifest;
    const registrationKey = `${capability}-${providerName}`;
    
    this.providers.set(registrationKey, provider);
    
    if (!this.defaultCapabilityMap.has(capability) || provider.manifest.mode === this.globalMode) {
      this.defaultCapabilityMap.set(capability, registrationKey);
    }
  }

  setPreferredProvider(capability: string, providerName: string) {
    const key = `${capability}-${providerName}`;
    if (!this.providers.has(key)) throw new Error(`Provider ${key} is not registered.`);
    this.defaultCapabilityMap.set(capability, key);
  }

  async resolve<T extends BaseProvider>(capability: string): Promise<T> {
    const primaryKey = this.defaultCapabilityMap.get(capability);
    if (!primaryKey) throw new Error(`[Fatal] No provider registered for capability: ${capability}`);

    const primaryProvider = this.providers.get(primaryKey);
    
    if (this.globalMode === 'native' && primaryProvider?.manifest.mode !== 'native') {
       return this.seekFallback<T>(capability, 'native');
    }

    try {
       const health = await primaryProvider?.healthCheck();
       if (health?.status === 'down') throw new Error('Primary provider is down');
       return primaryProvider as T;
    } catch (error) {
       console.warn(`[Registry] Primary '${primaryKey}' failed. Initiating fallback to Native...`);
       return this.seekFallback<T>(capability, 'native');
    }
  }

  private seekFallback<T extends BaseProvider>(capability: string, requiredMode: string): T {
    for (const [key, provider] of this.providers.entries()) {
       if (provider.manifest.capability === capability && provider.manifest.mode === requiredMode) {
          console.warn(`[Registry] Fallback Resolved: Routed to ${key}`);
          return provider as T;
       }
    }
    throw new Error(`[Fatal] Architecture violation: No '${requiredMode}' mode fallback provider for '${capability}'.`);
  }
}

export class EventBus {
  private listeners: Map<string, Function[]> = new Map();
  subscribe(event: string, callback: Function) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
  }
  publish(event: string, payload: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) callbacks.forEach(cb => cb(payload));
  }
}

export class Kernel {
  public readonly events = new EventBus();
  public readonly defaultMode = (process.env.MYCODEXVANTAOS_CORE_RUNTIME_MODE || 'hybrid') as 'native' | 'hybrid' | 'connected' | 'auto';
  public readonly registry = new ProviderRegistry(this.defaultMode);

  start() {
    this.events.publish('system:pre-start', { timestamp: Date.now() });
    this.events.publish('system:started', { status: 'running', timestamp: Date.now() });
  }
}
