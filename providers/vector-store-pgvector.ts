import { VectorStoreProvider } from '@mycodexvantaos/core-kernel';
export class ConnectedPgVectorProvider implements VectorStoreProvider {
  manifest = { capability: 'vector-store', provider: 'pgvector', mode: 'connected' as const };
  async initialize() {}
  async healthCheck() { return { status: 'down' as const, reason: 'Postgres DB unreachable' }; }
  async shutdown() {}
  async storeEmbedding(id: string, text: string, vector: number[]): Promise<boolean> { throw new Error("PG Down"); }
  async searchSimilar(vector: number[], topK?: number): Promise<any[]> { throw new Error("PG Down"); }
}
