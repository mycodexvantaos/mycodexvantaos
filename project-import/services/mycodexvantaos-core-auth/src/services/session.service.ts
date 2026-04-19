import { randomUUID } from 'node:crypto';
export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  expiresAt: number;
}

export class SessionService {
  private sessions = new Map<string, Session>();

  create(userId: string, ttlMs: number): Session {
    const now = Date.now();
    const session: Session = {
      id: randomUUID().replace(/-/g, ''),
      userId,
      createdAt: now,
      expiresAt: now + ttlMs,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | null {
    const session = this.sessions.get(id);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(id);
      return null;
    }
    return session;
  }

  revoke(id: string): boolean {
    return this.sessions.delete(id);
  }
}
