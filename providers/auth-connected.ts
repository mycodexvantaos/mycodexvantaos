import { AuthProvider } from '@mycodexvantaos/core-kernel';
export class ConnectedAuthProvider implements AuthProvider {
  manifest = { capability: 'auth', provider: 'oauth-keycloak', mode: 'connected' as const };
  private isOnline = false; // Simulate offline/unreachable identity provider
  async initialize() {}
  async healthCheck() { return this.isOnline ? { status: 'healthy' as const } : { status: 'down' as const, reason: 'IDP unreachable' }; }
  async shutdown() {}
  async verifyToken(token: string) { if (!this.isOnline) throw new Error("IDP Down"); return true; }
}
