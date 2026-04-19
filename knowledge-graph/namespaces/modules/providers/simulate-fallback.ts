import { Kernel, LlmProvider } from '../services/mycodexvantaos-core-kernel/src/index';
import { NativeLlmProvider } from './llm-native';
import { ConnectedGeminiProvider } from './llm-gemini';

async function simulatePlatformIndependence() {
  console.log('====== MyCodexVantaOS Platform Independence Simulation ======');
  
  // 1. Initialize Kernel (Mocking .env configuration as HYBRID)
  process.env.MYCODEXVANTAOS_CORE_RUNTIME_MODE = 'hybrid';
  const kernel = new Kernel();
  kernel.start();

  // 2. Instantiate and Register Providers
  const nativeLLM = new NativeLlmProvider();
  await nativeLLM.initialize();
  kernel.registry.register(nativeLLM);

  const geminiLLM = new ConnectedGeminiProvider();
  await geminiLLM.initialize(); 
  kernel.registry.register(geminiLLM);

  kernel.registry.setPreferredProvider('llm', 'gemini');

  console.log('\n--- [Scenario 1] Business Logic execution without API ---');
  try {
     const llmPlugin = await kernel.registry.resolve<LlmProvider>('llm');
     console.log(`[App] Acquired LLM Capability Instance. Provider used: ${llmPlugin.manifest.provider}`);
     
     const response = await llmPlugin.generate({
       prompt: "請提供這份文件的快速摘要 summary"
     });
     
     console.log('[App] Core Functionality execution success!');
     console.log('[App] Result ->', response.content);
  } catch (err) {
     console.error('[App Fatal Error] Core capability crashed app!', err);
  }

  console.log('\n--- [Scenario 2] Switching Runtime Mode entirely to Native ---');
  process.env.MYCODEXVANTAOS_CORE_RUNTIME_MODE = 'native';
  const localKernel = new Kernel(); 
  
  localKernel.registry.register(nativeLLM);
  localKernel.registry.register(geminiLLM); 

  const nativePlugin = await localKernel.registry.resolve<LlmProvider>('llm');
  console.log(`[App Second Run] Acquired Provider: ${nativePlugin.manifest.provider}`);
  const finalRes = await nativePlugin.generate({ prompt: "System status check" });
  console.log('[App Second Run] Result ->', finalRes.content);
}

simulatePlatformIndependence().catch(console.error);
