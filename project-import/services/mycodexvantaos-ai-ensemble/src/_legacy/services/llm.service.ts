/**
 * CodexvantaOS — ai-engine / LLMService
 * LLM inference abstraction — Native-first / Provider-agnostic
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface LLMRequest { model?: string; messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>; temperature?: number; maxTokens?: number; stream?: boolean; }
export interface LLMResponse { content: string; model: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number }; finishReason: string; latency: number; }

export class LLMService {
  private get providers() { return getProviders(); }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const start = Date.now();
    this.providers.observability.info('LLM request', { model: request.model ?? 'default', messageCount: request.messages.length });

    // Store request in queue for async processing / audit
    await this.providers.queue.enqueue('ai:llm:requests', { ...request, timestamp: Date.now() });

    // In native mode: use simple template-based responses
    // In connected mode: delegate to external LLM API via storage/custom provider
    const response: LLMResponse = {
      content: await this.inference(request),
      model: request.model ?? 'native-template',
      usage: { promptTokens: this.estimateTokens(request.messages), completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
      latency: Date.now() - start,
    };
    response.usage.completionTokens = this.estimateTokens([{ role: 'assistant', content: response.content }]);
    response.usage.totalTokens = response.usage.promptTokens + response.usage.completionTokens;

    // Cache response
    const cacheKey = `ai:llm:cache:${this.hashRequest(request)}`;
    await this.providers.stateStore.set(cacheKey, response, { ttl: 3600 });

    this.providers.observability.info('LLM response', { model: response.model, tokens: response.usage.totalTokens, latency: response.latency });
    return response;
  }

  async listModels(): Promise<Array<{ id: string; name: string; provider: string }>> {
    return [
      { id: 'native-template', name: 'Native Template Engine', provider: 'native' },
      { id: 'native-echo', name: 'Native Echo (debug)', provider: 'native' },
    ];
  }

  private async inference(request: LLMRequest): Promise<string> {
    const lastMessage = request.messages[request.messages.length - 1];
    // Native mode: template-based response generation
    return `[Native LLM] Processed: "${lastMessage.content.slice(0, 100)}"`;
  }

  private estimateTokens(messages: Array<{ content: string }>): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }

  private hashRequest(request: LLMRequest): string {
    const str = JSON.stringify(request.messages);
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash) + str.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }
}
