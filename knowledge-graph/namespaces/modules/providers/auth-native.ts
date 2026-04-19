import { AuthProvider } from '../services/mycodexvantaos-core-kernel/src/index';
export class NativeAuthProvider implements AuthProvider {
  manifest = { capability: 'auth', provider: 'native-jwt', mode: 'native' as const };
  async initialize() {}
  async healthCheck() { return { status: 'healthy' as const }; }
  async shutdown() {}
  async verifyToken(token: string) { return token.startsWith('dev-'); }
}
