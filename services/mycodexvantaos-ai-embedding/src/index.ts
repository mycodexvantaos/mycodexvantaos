/**
 * MyCodexVantaOS AI Embedding Service
 * 
 * AI embedding service implementing text embedding and LLM capabilities
 * Following naming-spec-v1 §5.1: mycodexvantaos-ai-embedding
 * 
 * @package @mycodexvantaos/ai-embedding
 * @version 1.0.0
 */

import {
  createSDK,
  LLMProvider,
  ObservabilityProvider,
  SecretsProvider,
} from '@mycodexvantaos/namespaces-sdk';
import { MyCodexVantaOSMapper, MyCodexVantaOSValidator } from '@mycodexvantaos/taxonomy-core';

/**
 * Service configuration
 */
export interface AIEmbeddingServiceConfig {
  /** Default embedding model */
  defaultEmbeddingModel: string;
  /** Default embedding dimension */
  defaultEmbeddingDimension: number;
  /** Default LLM model */
  defaultLLMModel: string;
  /** Maximum batch size */
  maxBatchSize: number;
  /** Request timeout in ms */
  timeout: number;
}

/**
 * Embedding request
 */
export interface EmbeddingRequest {
  text: string;
  model?: string;
}

/**
 * Batch embedding request
 */
export interface BatchEmbeddingRequest {
  texts: string[];
  model?: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimension: number;
  usage?: {
    tokens: number;
  };
}

/**
 * Batch embedding response
 */
export interface BatchEmbeddingResponse {
  embeddings: number[][];
  model: string;
  dimension: number;
  usage?: {
    totalTokens: number;
  };
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Chat request
 */
export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Chat response
 */
export interface ChatResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Service health status
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;
  providers: Record<string, string>;
  models: {
    embedding: string[];
    llm: string[];
  };
}

/**
 * MyCodexVantaOS AI Embedding Service
 */
export class AIEmbeddingService {
  private static readonly SERVICE_ID = 'mycodexvantaos-ai-embedding';
  private static readonly VERSION = '1.0.0';

  private config: AIEmbeddingServiceConfig;
  private sdk: Awaited<ReturnType<typeof createSDK>> | null = null;
  private llmProvider: LLMProvider | null = null;
  private observabilityProvider: ObservabilityProvider | null = null;
  private secretsProvider: SecretsProvider | null = null;
  private startTime: Date;

  constructor(config: Partial<AIEmbeddingServiceConfig> = {}) {
    this.config = {
      defaultEmbeddingModel: 'all-MiniLM-L6-v2',
      defaultEmbeddingDimension: 384,
      defaultLLMModel: 'llama-2-7b',
      maxBatchSize: 100,
      timeout: 30000,
      ...config,
    };
    this.startTime = new Date();

    // Validate service ID
    const validation = MyCodexVantaOSValidator.validateServiceId(AIEmbeddingService.SERVICE_ID);
    if (!validation.valid) {
      throw new Error(`Invalid service ID: ${validation.violations.map(v => v.message).join(', ')}`);
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    // Create SDK instance
    this.sdk = await createSDK({
      debug: process.env.MYCODEXVANTAOS_DEBUG === 'true',
      mode: 'native',
    });

    // Get providers
    const registry = this.sdk.getRegistry();
    
    // Get LLM provider (includes embedding capability)
    this.llmProvider = registry.getByCapabilityFirst('llm') as LLMProvider;
    if (!this.llmProvider) {
      throw new Error('LLM provider not available');
    }

    // Get optional providers
    this.observabilityProvider = registry.getByCapabilityFirst('observability') as ObservabilityProvider;
    this.secretsProvider = registry.getByCapabilityFirst('secrets') as SecretsProvider;

    await this.log('info', 'AI Embedding Service initialized', {
      serviceId: AIEmbeddingService.SERVICE_ID,
      version: AIEmbeddingService.VERSION,
    });
  }

  /**
   * Generate embedding for a single text
   */
  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    this.ensureInitialized();

    const model = request.model || this.config.defaultEmbeddingModel;
    
    const embedding = await this.llmProvider!.embedding(request.text);

    await this.log('debug', 'Embedding generated', { model, dimension: embedding.length });

    return {
      embedding,
      model,
      dimension: embedding.length,
    };
  }

  /**
   * Generate embeddings for multiple texts
   */
  async embedBatch(request: BatchEmbeddingRequest): Promise<BatchEmbeddingResponse> {
    this.ensureInitialized();

    if (request.texts.length > this.config.maxBatchSize) {
      throw new Error(`Batch size ${request.texts.length} exceeds maximum ${this.config.maxBatchSize}`);
    }

    const model = request.model || this.config.defaultEmbeddingModel;
    
    const embeddings: number[][] = [];
    let totalTokens = 0;

    for (const text of request.texts) {
      const embedding = await this.llmProvider!.embedding(text);
      embeddings.push(embedding);
      totalTokens += this.estimateTokens(text);
    }

    await this.log('info', 'Batch embeddings generated', { 
      model, 
      count: embeddings.length,
      totalTokens,
    });

    return {
      embeddings,
      model,
      dimension: embeddings[0]?.length || 0,
      usage: { totalTokens },
    };
  }

  /**
   * Chat completion
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    this.ensureInitialized();

    const model = request.model || this.config.defaultLLMModel;
    
    const response = await this.llmProvider!.chat(
      request.messages.map(m => ({
        role: m.role,
        content: m.content,
      }))
    );

    await this.log('info', 'Chat completion', { 
      model,
      messageCount: request.messages.length,
      responseLength: response.content.length,
    });

    return {
      content: response.content,
      model,
      usage: response.usage ? {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
        totalTokens: response.usage.promptTokens + response.usage.completionTokens,
      } : undefined,
    };
  }

  /**
   * Streaming chat completion
   */
  async chatStream(
    request: ChatRequest,
    onChunk: (chunk: string) => void
  ): Promise<ChatResponse> {
    this.ensureInitialized();

    const model = request.model || this.config.defaultLLMModel;
    
    let fullContent = '';
    
    await this.llmProvider!.streamChat(
      request.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      (chunk) => {
        fullContent += chunk;
        onChunk(chunk);
      }
    );

    await this.log('info', 'Streaming chat completion', { 
      model,
      messageCount: request.messages.length,
      responseLength: fullContent.length,
    });

    return {
      content: fullContent,
      model,
    };
  }

  /**
   * Get available models
   */
  getAvailableModels(): { embedding: string[]; llm: string[] } {
    return {
      embedding: [this.config.defaultEmbeddingModel],
      llm: [this.config.defaultLLMModel],
    };
  }

  /**
   * Get service health
   */
  async getHealth(): Promise<ServiceHealth> {
    const providers: Record<string, string> = {};

    // Check LLM provider
    if (this.llmProvider) {
      try {
        const health = await this.llmProvider.healthCheck();
        providers['llm'] = health.status;
      } catch {
        providers['llm'] = 'error';
      }
    }

    // Check observability provider
    if (this.observabilityProvider) {
      try {
        const health = await this.observabilityProvider.healthCheck();
        providers['observability'] = health.status;
      } catch {
        providers['observability'] = 'error';
      }
    }

    // Check secrets provider
    if (this.secretsProvider) {
      try {
        const health = await this.secretsProvider.healthCheck();
        providers['secrets'] = health.status;
      } catch {
        providers['secrets'] = 'error';
      }
    }

    // Determine overall status
    const status = Object.values(providers).includes('unhealthy')
      ? 'unhealthy'
      : Object.values(providers).includes('degraded')
      ? 'degraded'
      : 'healthy';

    const models = this.getAvailableModels();

    return {
      status,
      version: AIEmbeddingService.VERSION,
      uptime: Date.now() - this.startTime.getTime(),
      providers,
      models,
    };
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    await this.log('info', 'AI Embedding Service shutting down');

    if (this.sdk) {
      await this.sdk.shutdown();
    }

    this.llmProvider = null;
    this.observabilityProvider = null;
    this.secretsProvider = null;
    this.sdk = null;
  }

  /**
   * Estimate token count (simple approximation)
   */
  private estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token on average
    return Math.ceil(text.length / 4);
  }

  /**
   * Log a message
   */
  private async log(level: 'info' | 'warn' | 'error' | 'debug', message: string, metadata?: Record<string, unknown>): Promise<void> {
    if (this.observabilityProvider) {
      await this.observabilityProvider.log(level as any, message, {
        service: AIEmbeddingService.SERVICE_ID,
        ...metadata,
      });
    } else {
      console.log(`[${level.toUpperCase()}] [${AIEmbeddingService.SERVICE_ID}] ${message}`, metadata || '');
    }
  }

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.sdk || !this.llmProvider) {
      throw new Error('Service not initialized. Call initialize() first.');
    }
  }
}

/**
 * Create service instance
 */
export function createAIEmbeddingService(config?: Partial<AIEmbeddingServiceConfig>): AIEmbeddingService {
  return new AIEmbeddingService(config);
}

/**
 * Default export
 */
export default AIEmbeddingService;