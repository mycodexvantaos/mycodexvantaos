/**
 * MyCodexVantaOS OpenAI LLM Provider
 * 
 * External provider for OpenAI large language model operations.
 * naming-spec-v1 compliant: llm-openai
 * 
 * @module @mycodexvantaos/llm-openai
 */

import OpenAI from 'openai';
import {
  BaseProvider,
  LLMProvider,
  ProviderConfig,
  ProviderHealth,
  ProviderStatus
} from '@mycodexvantaos/namespaces-sdk';

/**
 * OpenAI provider configuration
 * Environment variables follow naming-spec-v1 §7.2: MYCODEXVANTAOS_<SUBSYSTEM>_<KEY>
 */
export interface OpenAILLMProviderConfig extends ProviderConfig {
  apiKey: string;
  organization?: string;
  defaultModel?: string;
  embeddingModel?: string;
  maxRetries?: number;
  timeout?: number;
  baseURL?: string;
}

/**
 * Chat message types
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function' | 'tool';
  content: string | ChatContent[];
  name?: string;
  functionCall?: FunctionCall;
  toolCallId?: string;
}

/**
 * Chat content part for multimodal messages
 */
export type ChatContent = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

/**
 * Function call result
 */
export interface FunctionCall {
  name: string;
  arguments: string;
}

/**
 * Function definition for tool calling
 */
export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

/**
 * Chat completion options
 */
export interface ChatCompletionOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stop?: string | string[];
  functions?: FunctionDefinition[];
  functionCall?: 'auto' | 'none' | { name: string };
  tools?: Array<{
    type: 'function';
    function: FunctionDefinition;
  }>;
  responseFormat?: { type: 'text' | 'json_object' };
  seed?: number;
}

/**
 * Chat completion result
 */
export interface ChatCompletionResult {
  id: string;
  model: string;
  message: ChatMessage;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: string;
  functionCall?: FunctionCall;
  toolCalls?: Array<{
    id: string;
    type: 'function';
    function: FunctionCall;
  }>;
}

/**
 * Embedding result
 */
export interface EmbeddingResult {
  embeddings: number[][];
  model: string;
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
}

/**
 * Streaming chat chunk
 */
export interface StreamChunk {
  id: string;
  model: string;
  delta: {
    role?: string;
    content?: string;
    functionCall?: Partial<FunctionCall>;
    toolCalls?: Array<{
      index: number;
      id?: string;
      type?: 'function';
      function?: Partial<FunctionCall>;
    }>;
  };
  finishReason: string | null;
}

/**
 * OpenAI LLM Provider
 * 
 * Implements the LLMProvider interface using OpenAI's API.
 * Supports GPT-4, GPT-3.5, streaming, function calling, and embeddings.
 * 
 * @example
 * ```typescript
 * const provider = new OpenAILLMProvider({
 *   apiKey: process.env.MYCODEXVANTAOS_LLM_API_KEY,
 *   defaultModel: 'gpt-4-turbo-preview'
 * });
 * 
 * await provider.initialize();
 * const response = await provider.chat([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'Hello!' }
 * ]);
 * ```
 */
export class OpenAILLMProvider extends BaseProvider implements LLMProvider {
  readonly id = 'llm-openai';
  readonly capability = 'llm' as const;
  readonly providerName = 'openai';
  
  private client: OpenAI | null = null;
  private config: Required<Omit<OpenAILLMProviderConfig, 'organization' | 'baseURL'>> & 
    Pick<OpenAILLMProviderConfig, 'organization' | 'baseURL'>;

  constructor(config: OpenAILLMProviderConfig) {
    super(config);
    this.config = {
      defaultModel: 'gpt-4-turbo-preview',
      embeddingModel: 'text-embedding-3-small',
      maxRetries: 3,
      timeout: 60000,
      ...config
    } as Required<Omit<OpenAILLMProviderConfig, 'organization' | 'baseURL'>> & 
      Pick<OpenAILLMProviderConfig, 'organization' | 'baseURL'>;
  }

  /**
   * Initialize the OpenAI client
   */
  async initialize(): Promise<void> {
    if (this.client) {
      return;
    }

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      organization: this.config.organization,
      baseURL: this.config.baseURL,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    });

    // Verify API key by listing models
    await this.client.models.list();

    this.status = ProviderStatus.READY;
    console.log('[llm-openai] Initialized successfully');
  }

  /**
   * Shutdown the client
   */
  async shutdown(): Promise<void> {
    this.client = null;
    this.status = ProviderStatus.STOPPED;
    console.log('[llm-openai] Shutdown complete');
  }

  /**
   * Check provider health
   */
  async healthCheck(): Promise<ProviderHealth> {
    const startTime = Date.now();
    
    try {
      if (!this.client) {
        return {
          status: ProviderStatus.ERROR,
          message: 'OpenAI client not initialized',
          timestamp: new Date().toISOString(),
          latency: 0
        };
      }

      // Simple API call to verify connectivity
      await this.client.models.list();
      const latency = Date.now() - startTime;

      return {
        status: ProviderStatus.READY,
        message: 'OpenAI API connection healthy',
        timestamp: new Date().toISOString(),
        latency,
        details: {
          defaultModel: this.config.defaultModel,
          embeddingModel: this.config.embeddingModel
        }
      };
    } catch (error) {
      return {
        status: ProviderStatus.ERROR,
        message: `Health check failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString(),
        latency: Date.now() - startTime
      };
    }
  }

  /**
   * Create a chat completion
   */
  async chat(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult> {
    this.ensureReady();

    const response = await this.client!.chat.completions.create({
      model: options?.model || this.config.defaultModel,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'function' | 'tool',
        content: m.content,
        name: m.name,
        function_call: m.functionCall,
        tool_call_id: m.toolCallId,
      })),
      temperature: options?.temperature,
      top_p: options?.topP,
      max_tokens: options?.maxTokens,
      stop: options?.stop,
      functions: options?.functions,
      function_call: options?.functionCall,
      tools: options?.tools,
      response_format: options?.responseFormat,
      seed: options?.seed,
    });

    const choice = response.choices[0];

    return {
      id: response.id,
      model: response.model,
      message: {
        role: choice.message.role as ChatMessage['role'],
        content: choice.message.content || '',
        functionCall: choice.message.function_call as FunctionCall | undefined,
        toolCalls: choice.message.tool_calls?.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
      usage: {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0,
      },
      finishReason: choice.finish_reason,
      functionCall: choice.message.function_call as FunctionCall | undefined,
    };
  }

  /**
   * Stream a chat completion
   */
  async *streamChat(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    this.ensureReady();

    const stream = await this.client!.chat.completions.create({
      model: options?.model || this.config.defaultModel,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant' | 'function' | 'tool',
        content: m.content,
        name: m.name,
      })),
      temperature: options?.temperature,
      top_p: options?.topP,
      max_tokens: options?.maxTokens,
      stop: options?.stop,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      if (!delta) continue;

      yield {
        id: chunk.id,
        model: chunk.model,
        delta: {
          role: delta.role,
          content: delta.content || undefined,
          functionCall: delta.function_call ? {
            name: delta.function_call.name || undefined,
            arguments: delta.function_call.arguments || undefined,
          } : undefined,
        },
        finishReason: chunk.choices[0]?.finish_reason || null,
      };
    }
  }

  /**
   * Create a completion (legacy)
   */
  async complete(
    prompt: string,
    options?: ChatCompletionOptions
  ): Promise<string> {
    const result = await this.chat([
      { role: 'user', content: prompt }
    ], options);
    
    return result.message.content as string;
  }

  /**
   * Create embeddings for a single text
   */
  async embed(text: string, model?: string): Promise<number[]> {
    this.ensureReady();

    const response = await this.client!.embeddings.create({
      model: model || this.config.embeddingModel,
      input: text,
    });

    return response.data[0].embedding;
  }

  /**
   * Create embeddings for multiple texts
   */
  async embedBatch(texts: string[], model?: string): Promise<EmbeddingResult> {
    this.ensureReady();

    const response = await this.client!.embeddings.create({
      model: model || this.config.embeddingModel,
      input: texts,
    });

    return {
      embeddings: response.data.map(d => d.embedding),
      model: response.model,
      usage: {
        promptTokens: response.usage.prompt_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };
  }

  /**
   * Call a function with the LLM
   */
  async functionCall<T = unknown>(
    messages: ChatMessage[],
    functions: FunctionDefinition[],
    options?: ChatCompletionOptions
  ): Promise<{ result: T; functionName: string; arguments: Record<string, unknown> }> {
    this.ensureReady();

    const response = await this.chat(messages, {
      ...options,
      functions,
      functionCall: 'auto',
    });

    if (!response.functionCall) {
      throw new Error('No function call in response');
    }

    const args = JSON.parse(response.functionCall.arguments);
    
    return {
      result: args as T,
      functionName: response.functionCall.name,
      arguments: args,
    };
  }

  /**
   * List available models
   */
  async listModels(): Promise<Array<{ id: string; ownedBy: string }>> {
    this.ensureReady();

    const models = await this.client!.models.list();
    
    return models.data
      .filter(m => m.id.includes('gpt') || m.id.includes('text-embedding'))
      .map(m => ({
        id: m.id,
        ownedBy: m.owned_by,
      }));
  }

  /**
   * Count tokens (approximate)
   */
  countTokens(text: string): number {
    // Rough approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  private ensureReady(): void {
    if (!this.client) {
      throw new Error('OpenAI provider not initialized. Call initialize() first.');
    }
    if (this.status !== ProviderStatus.READY) {
      throw new Error(`OpenAI provider not ready. Current status: ${this.status}`);
    }
  }
}

// Export provider class and types
export default OpenAILLMProvider;