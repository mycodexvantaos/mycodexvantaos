import { Kernel, AuthProvider, VectorStoreProvider, LlmProvider, ObservabilityProvider } from '@mycodexvantaos/core-kernel';

export class AgentEnsemble {
  constructor(private kernel: Kernel) {}

  async processQuery(token: string, query: string) {
     const obs = await this.kernel.registry.resolve<ObservabilityProvider>('observability');
     obs.log('info', `🧠 AgentEnsemble receiving query: "${query}"`);

     // 1. Resolve Auth Capability & Verify
     const auth = await this.kernel.registry.resolve<AuthProvider>('auth');
     if (!(await auth.verifyToken(token))) {
        obs.log('error', 'Unauthorized access attempt.');
        throw new Error('Unauthorized');
     }

     // 2. Resolve Vector Store Capability & Retrieve
     const vectorStore = await this.kernel.registry.resolve<VectorStoreProvider>('vector-store');
     obs.log('info', `🔍 Retrieving RAG context using ${vectorStore.manifest.provider}...`);
     const context = await vectorStore.searchSimilar([0.1, 0.2]);

     // 3. Resolve LLM Capability & Generate
     const llm = await this.kernel.registry.resolve<LlmProvider>('llm');
     obs.log('info', `💡 Generating response using ${llm.manifest.provider}...`);
     
     const response = await llm.generate({ prompt: `${query} Context: ${context[0].text}` });
     obs.publishMetrics('run-888', { length: response.content.length });
     
     return response.content;
  }
}
