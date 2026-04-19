import { VectorStoreProvider } from '../services/mycodexvantaos-core-kernel/src/index';
export class ConnectedPgVectorProvider implements VectorStoreProvider {
  manifest = { capability: 'vector-store', provider: 'pgvector', mode: 'connected' as const };
  async initialize() {}
  async healthCheck() { return { status: 'down' as const, reason: 'Postgres DB unreachable' }; }
  async shutdown() {}
  async storeEmbedding(id: string, text: string, vector: number[]) { throw new Error("PG Down"); return false; }
  async searchSimilar(vector: number[], topK?: number) { throw new Error("PG Down"); return []; }
}
