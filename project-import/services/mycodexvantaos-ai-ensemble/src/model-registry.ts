import type { LLMModel, LLMResponse } from "./types";

let counter = 0;

export class ModelRegistryService {
  private models = new Map<string, LLMModel>();

  register(name: string, provider: string, contextLength: number): LLMModel {
    const id = `model-${++counter}`;
    const model: LLMModel = { id, name, provider, contextLength };
    this.models.set(id, model);
    return model;
  }

  unregister(modelId: string): boolean {
    return this.models.delete(modelId);
  }

  getModel(modelId: string): LLMModel | null {
    return this.models.get(modelId) ?? null;
  }

  findByName(name: string): LLMModel | null {
    for (const model of this.models.values()) {
      if (model.name === name) return model;
    }
    return null;
  }

  listModels(): LLMModel[] {
    return Array.from(this.models.values());
  }

  listByProvider(provider: string): LLMModel[] {
    return this.listModels().filter((m) => m.provider === provider);
  }

  complete(modelId: string, prompt: string): LLMResponse {
    const model = this.models.get(modelId);
    if (!model) throw new Error(`Model ${modelId} not found`);
    const promptTokens = Math.ceil(prompt.length / 4);
    const completionTokens = Math.ceil(promptTokens * 0.5);
    return {
      content: `[stub response from ${model.name}]`,
      model: model.name,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
      finishReason: "stop",
    };
  }
}