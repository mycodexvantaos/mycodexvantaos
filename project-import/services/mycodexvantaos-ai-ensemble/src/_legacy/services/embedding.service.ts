/**
 * CodexvantaOS — ai-engine / EmbeddingService
 * Text embedding generation and similarity search
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface EmbeddingResult { text: string; vector: number[]; model: string; dimensions: number; }

export class EmbeddingService {
  private get providers() { return getProviders(); }
  private readonly DIMENSIONS = 128; // Native mode: simple hash-based embeddings

  async embed(texts: string[]): Promise<EmbeddingResult[]> {
    this.providers.observability.info('Embedding request', { textCount: texts.length });
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      const vector = this.nativeEmbed(text);
      results.push({ text, vector, model: 'native-hash', dimensions: this.DIMENSIONS });
    }
    // Store embeddings for later retrieval
    for (const result of results) {
      const key = `ai:embedding:${this.hashText(result.text)}`;
      await this.providers.stateStore.set(key, result, { ttl: 86400 });
    }
    return results;
  }

  async similarity(queryVector: number[], topK: number = 5): Promise<Array<{ text: string; score: number }>> {
    const result = await this.providers.stateStore.scan<EmbeddingResult>({ pattern: 'ai:embedding:*', count: 100 });
    const scored = result.entries.map(entry => ({
      text: entry.value.text,
      score: this.cosineSimilarity(queryVector, entry.value.vector),
    }));
    return scored.sort((a, b) => b.score - a.score).slice(0, topK);
  }

  private nativeEmbed(text: string): number[] {
    // Simple hash-based embedding for native mode
    const vector: number[] = new Array(this.DIMENSIONS).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      for (let j = 0; j < word.length; j++) {
        const idx = (word.charCodeAt(j) * (i + 1) * (j + 1)) % this.DIMENSIONS;
        vector[idx] += 1.0 / words.length;
      }
    }
    // Normalize
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
    return vector.map(v => v / magnitude);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; magA += a[i] * a[i]; magB += b[i] * b[i]; }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) { hash = ((hash << 5) - hash) + text.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }
}
