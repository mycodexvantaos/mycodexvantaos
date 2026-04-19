import * as fs from 'fs';
import * as path from 'path';

const write = (p: string, content: string) => {
  const fullPath = path.join(process.cwd(), p);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
  console.log(`[Upgraded] ${fullPath}`);
};

// ============================================================================
// 1. CORE KERNEL UPGRADE (All Interfaces & Standard Registry)
// ============================================================================
write('packages/mycodexvantaos-core-kernel/src/index.ts', `
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
    const registrationKey = \`\${capability}-\${providerName}\`;
    
    this.providers.set(registrationKey, provider);
    
    if (!this.defaultCapabilityMap.has(capability) || provider.manifest.mode === this.globalMode) {
      this.defaultCapabilityMap.set(capability, registrationKey);
    }
  }

  setPreferredProvider(capability: string, providerName: string) {
    const key = \`\${capability}-\${providerName}\`;
    if (!this.providers.has(key)) throw new Error(\`Provider \${key} is not registered.\`);
    this.defaultCapabilityMap.set(capability, key);
  }

  async resolve<T extends BaseProvider>(capability: string): Promise<T> {
    const primaryKey = this.defaultCapabilityMap.get(capability);
    if (!primaryKey) throw new Error(\`[Fatal] No provider registered for capability: \${capability}\`);

    const primaryProvider = this.providers.get(primaryKey);
    
    if (this.globalMode === 'native' && primaryProvider?.manifest.mode !== 'native') {
       return this.seekFallback<T>(capability, 'native');
    }

    try {
       const health = await primaryProvider?.healthCheck();
       if (health?.status === 'down') throw new Error('Primary provider is down');
       return primaryProvider as T;
    } catch (error) {
       console.warn(\`[Registry] Primary '\${primaryKey}' failed. Initiating fallback to Native...\`);
       return this.seekFallback<T>(capability, 'native');
    }
  }

  private seekFallback<T extends BaseProvider>(capability: string, requiredMode: string): T {
    for (const [key, provider] of this.providers.entries()) {
       if (provider.manifest.capability === capability && provider.manifest.mode === requiredMode) {
          console.warn(\`[Registry] Fallback Resolved: Routed to \${key}\`);
          return provider as T;
       }
    }
    throw new Error(\`[Fatal] Architecture violation: No '\${requiredMode}' mode fallback provider for '\${capability}'.\`);
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
`);

// ============================================================================
// 2. AUTH PROVIDERS (Native + Connected)
// ============================================================================
write('providers/auth-native.ts', `
import { AuthProvider } from '@mycodexvantaos/core-kernel';
export class NativeAuthProvider implements AuthProvider {
  manifest = { capability: 'auth', provider: 'native-jwt', mode: 'native' as const };
  async initialize() {}
  async healthCheck() { return { status: 'healthy' as const }; }
  async shutdown() {}
  async verifyToken(token: string) { return token.startsWith('dev-'); }
}
`);

write('providers/auth-connected.ts', `
import { AuthProvider } from '@mycodexvantaos/core-kernel';
export class ConnectedAuthProvider implements AuthProvider {
  manifest = { capability: 'auth', provider: 'oauth-keycloak', mode: 'connected' as const };
  private isOnline = false; // Simulate offline/unreachable identity provider
  async initialize() {}
  async healthCheck() { return this.isOnline ? { status: 'healthy' as const } : { status: 'down' as const, reason: 'IDP unreachable' }; }
  async shutdown() {}
  async verifyToken(token: string) { if (!this.isOnline) throw new Error("IDP Down"); return true; }
}
`);

// ============================================================================
// 3. VECTOR STORE PROVIDERS (Native + Connected)
// ============================================================================
write('providers/vector-store-native.ts', `
import { VectorStoreProvider } from '@mycodexvantaos/core-kernel';
export class NativeVectorStoreProvider implements VectorStoreProvider {
  manifest = { capability: 'vector-store', provider: 'native-memory', mode: 'native' as const };
  private store = new Map();
  async initialize() {}
  async healthCheck() { return { status: 'healthy' as const }; }
  async shutdown() {}
  async storeEmbedding(id: string, text: string, vec: number[]) { this.store.set(id, text); return true; }
  async searchSimilar(vec: number[]) { return [{ id: 'mock-1', text: '[Native RAG] Offline cached knowledge retrieved.' }]; }
}
`);

write('providers/vector-store-pgvector.ts', `
import { VectorStoreProvider } from '@mycodexvantaos/core-kernel';
export class ConnectedPgVectorProvider implements VectorStoreProvider {
  manifest = { capability: 'vector-store', provider: 'pgvector', mode: 'connected' as const };
  async initialize() {}
  async healthCheck() { return { status: 'down' as const, reason: 'Postgres DB unreachable' }; }
  async shutdown() {}
  async storeEmbedding(id: string, text: string, vector: number[]): Promise<boolean> { throw new Error("PG Down"); }
  async searchSimilar(vector: number[], topK?: number): Promise<any[]> { throw new Error("PG Down"); }
}
`);

// ============================================================================
// 4. OBSERVABILITY PROVIDERS (Native + Connected)
// ============================================================================
write('providers/observability-native.ts', \`
import { ObservabilityProvider } from '@mycodexvantaos/core-kernel';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class NativeObservabilityProvider implements ObservabilityProvider {
  manifest = { capability: 'observability', provider: 'native-console', mode: 'native' as const };
  async initialize() {}
  async healthCheck() { return { status: 'healthy' as const }; }
  async shutdown() {}
  log(level: string, msg: string) { console.log(\`[\\\${level.toUpperCase()}] \\\${msg}\`); }
  
  async publishMetrics(id: string, metrics: any) { 
    console.log(\`[Metrics] Delegating publication for \\\${id} to publish-metrics.py...\`);
    const tempFile = path.join(process.cwd(), \`.temp-metrics-\\\${id}.json\`);
    fs.writeFileSync(tempFile, JSON.stringify(metrics, null, 2), 'utf8');

    const scriptPath = path.join(process.cwd(), 'vector-store', 'retrieval-pipelines', 'src', 'publish-metrics.py');
    exec(\`python3 "\\\${scriptPath}" --execution-id="\\\${id}" --state-file="\\\${tempFile}"\`, (error, stdout, stderr) => {
      if (error) {
         console.error(\`[Metrics Error] Failed to run publish-metrics.py: \\\${error.message}\`);
         return;
      }
      if (stderr) console.error(\`[Metrics Stderr] \\\${stderr}\`);
      console.log(stdout.trim());
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
    });
  }
}
\`);

// ============================================================================
// 5. DOMAIN SERVICE UPGRADE: AI ENSEMBLE
// ============================================================================
// Note: It now STRICTLY depends on registry.resolve(), zero hardcoded providers.
write('services/mycodexvantaos-ai-ensemble/src/index.ts', `
import { Kernel, AuthProvider, VectorStoreProvider, LlmProvider, ObservabilityProvider } from '@mycodexvantaos/core-kernel';

export class AgentEnsemble {
  constructor(private kernel: Kernel) {}

  async processQuery(token: string, query: string) {
     const obs = await this.kernel.registry.resolve<ObservabilityProvider>('observability');
     obs.log('info', \`🧠 AgentEnsemble receiving query: "\${query}"\`);

     // 1. Resolve Auth Capability & Verify
     const auth = await this.kernel.registry.resolve<AuthProvider>('auth');
     if (!(await auth.verifyToken(token))) {
        obs.log('error', 'Unauthorized access attempt.');
        throw new Error('Unauthorized');
     }

     // 2. Resolve Vector Store Capability & Retrieve
     const vectorStore = await this.kernel.registry.resolve<VectorStoreProvider>('vector-store');
     obs.log('info', \`🔍 Retrieving RAG context using \${vectorStore.manifest.provider}...\`);
     const context = await vectorStore.searchSimilar([0.1, 0.2]);

     // 3. Resolve LLM Capability & Generate
     const llm = await this.kernel.registry.resolve<LlmProvider>('llm');
     obs.log('info', \`💡 Generating response using \${llm.manifest.provider}...\`);
     
     const response = await llm.generate({ prompt: \`\${query} Context: \${context[0].text}\` });
     obs.publishMetrics('run-888', { length: response.content.length });
     
     return response.content;
  }
}
`);

// ============================================================================
// 6. PLATFORM SIMULATION (Unified Test)
// ============================================================================
write('simulation-global.ts', `
import { Kernel } from '@mycodexvantaos/core-kernel';
// Providers
import { NativeLlmProvider } from './providers/llm-native';
import { ConnectedGeminiProvider } from './providers/llm-gemini';
import { NativeAuthProvider } from './providers/auth-native';
import { ConnectedAuthProvider } from './providers/auth-connected';
import { NativeVectorStoreProvider } from './providers/vector-store-native';
import { ConnectedPgVectorProvider } from './providers/vector-store-pgvector';
import { NativeObservabilityProvider } from './providers/observability-native';

// Domain Service
import { AgentEnsemble } from './services/mycodexvantaos-ai-ensemble/src/index';

async function runGlobalSimulation() {
  console.log('===========================================================');
  console.log('🌐 MyCodexVantaOS Global "Architecture-as-Code" Simulation');
  console.log('===========================================================\\n');

  // Force environment to Hybrid to test intelligent fallback across EVERYTHING
  process.env.MYCODEXVANTAOS_CORE_RUNTIME_MODE = 'hybrid';
  const kernel = new Kernel();

  // Bootstrapping All Native Fallbacks (The Survival Net)
  kernel.registry.register(new NativeLlmProvider());
  kernel.registry.register(new NativeAuthProvider());
  kernel.registry.register(new NativeVectorStoreProvider());
  kernel.registry.register(new NativeObservabilityProvider());

  // Bootstrapping All Connected Providers (The Production APIs - currently simulated as OFFLINE)
  kernel.registry.register(new ConnectedGeminiProvider());
  kernel.registry.register(new ConnectedAuthProvider());
  kernel.registry.register(new ConnectedPgVectorProvider());

  // Define preferences towards Production APIs
  kernel.registry.setPreferredProvider('llm', 'gemini');
  kernel.registry.setPreferredProvider('auth', 'oauth-keycloak');
  kernel.registry.setPreferredProvider('vector-store', 'pgvector');
  kernel.registry.setPreferredProvider('observability', 'native-console');

  kernel.start();
  console.log('\\n🚀 Executing AI Ensemble Process (Token: dev-admin, Task: Code Review)\\n');
  
  const agent = new AgentEnsemble(kernel);
  try {
    const result = await agent.processQuery('dev-admin-token', 'Review the architecture');
    console.log('\\n✨ [FINAL RESULT] ->', result);
  } catch (err) {
    console.error('System crashed:', err);
  }
}

runGlobalSimulation().catch(console.error);
`);
