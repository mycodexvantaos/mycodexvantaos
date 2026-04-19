import { LlmProvider, LlmCompletionRequest, LlmCompletionResponse } from '@mycodexvantaos/core-kernel';

/**
 * Native "Dumb but working" implementation.
 * Platform independence guarantee: If internet is down or API token expires,
 * the system seamlessly routes here.
 */
export class NativeLlmProvider implements LlmProvider {
  public manifest = {
    capability: 'llm',
    provider: 'native-rules',
    mode: 'native' as const
  };

  async initialize(config?: any): Promise<void> {
    console.log('[Provider: llm-native] Initialized local rule-based LLM engine.');
  }

  async healthCheck(): Promise<{ status: "healthy" | "degraded" | "down"; reason?: string | undefined; }> {
    return { status: 'healthy' }; // Native is always healthy by definition
  }

  async shutdown(): Promise<void> {
     // Cleanup local caches
  }

  async generate(request: LlmCompletionRequest): Promise<LlmCompletionResponse> {
    // Extremely simplified "AI" based on Regex/Rules, or interacting with a tiny ONNX local model.
    // By keeping the interface identical, the业务逻辑 (business logic) remains completely unaware.
    const lowerPrompt = request.prompt.toLowerCase();
    let responseText = "本地離線處理：很抱歉，我無法理解此複雜邏輯或無外部網路。";

    if (lowerPrompt.includes('summary') || lowerPrompt.includes('摘要')) {
       responseText = `本地離線提取：這是一段關於 "${request.prompt.substring(0, 20)}..." 的長文摘要內容。`;
    } else if (lowerPrompt.includes('error') || lowerPrompt.includes('錯誤')) {
       responseText = `本地離線除錯建議：請檢察此區段程式碼或網路連線。`;
    }

    return {
      content: responseText,
      providerUsed: 'native-rules'
    };
  }
}
