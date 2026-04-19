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
  console.log('===========================================================\n');

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
  console.log('\n🚀 Executing AI Ensemble Process (Token: dev-admin, Task: Code Review)\n');
  
  const agent = new AgentEnsemble(kernel);
  try {
    const result = await agent.processQuery('dev-admin-token', 'Review the architecture');
    console.log('\n✨ [FINAL RESULT] ->', result);
  } catch (err) {
    console.error('System crashed:', err);
  }
}

runGlobalSimulation().catch(console.error);
