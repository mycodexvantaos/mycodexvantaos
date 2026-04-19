/**
 * NativeAuthProvider — Local JWT + file-based user store
 * 
 * Zero external dependencies. Implements authentication using:
 *  - HMAC-SHA256 JWT tokens (Node.js crypto, no jsonwebtoken dep)
 *  - File-based user/session store (JSON)
 *  - bcrypt-compatible password hashing (via built-in scrypt)
 * 
 * No Auth0, no Supabase Auth, no Firebase Auth required.
 */

import type {
  AuthProvider,
  AuthUser,
  AuthSession,
  SignInInput,
  SignInResult,
  AuthHealth,
} from '../../interfaces/auth';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface NativeAuthConfig {
  /** Directory to store user/session data. */
  dataDir?: string;
  /** Secret key for JWT signing. Auto-generated if not provided. */
  jwtSecret?: string;
  /** Token expiry in seconds (default 24h). */
  tokenExpirySec?: number;
  /** Session expiry in seconds (default 7d). */
  sessionExpirySec?: number;
}

interface StoredUser {
  id: string;
  email: string;
  name?: string;
  passwordHash: string;
  salt: string;
  roles: string[];
  createdAt: number;
  updatedAt: number;
  disabled: boolean;
}

interface StoredSession {
  id: string;
  userId: string;
  token: string;
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
}

export class NativeAuthProvider implements AuthProvider {
  readonly providerId = 'native-jwt-file';
  readonly mode = 'native' as const;

  private config: Required<NativeAuthConfig>;
  private usersFile: string;
  private sessionsFile: string;

  constructor(config?: NativeAuthConfig) {
    const dataDir = config?.dataDir ?? path.join(process.cwd(), '.codexvanta', 'auth');
    this.config = {
      dataDir,
      jwtSecret: config?.jwtSecret ?? '',
      tokenExpirySec: config?.tokenExpirySec ?? 86400,
      sessionExpirySec: config?.sessionExpirySec ?? 604800,
    };
    this.usersFile = path.join(dataDir, 'users.json');
    this.sessionsFile = path.join(dataDir, 'sessions.json');
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }

    // Auto-generate JWT secret if not provided
    if (!this.config.jwtSecret) {
      const secretFile = path.join(this.config.dataDir, '.jwt-secret');
      if (fs.existsSync(secretFile)) {
        this.config.jwtSecret = fs.readFileSync(secretFile, 'utf-8').trim();
      } else {
        this.config.jwtSecret = crypto.randomBytes(64).toString('hex');
        fs.writeFileSync(secretFile, this.config.jwtSecret, { mode: 0o600 });
      }
    }

    // Initialise data files if they don't exist
    if (!fs.existsSync(this.usersFile)) {
      fs.writeFileSync(this.usersFile, '[]', { mode: 0o600 });
    }
    if (!fs.existsSync(this.sessionsFile)) {
      fs.writeFileSync(this.sessionsFile, '[]', { mode: 0o600 });
    }
  }

  async signIn(input: SignInInput): Promise<SignInResult> {
    const users = this.loadUsers();
    const user = users.find(u => u.email === input.email);

    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    if (user.disabled) {
      return { success: false, error: 'Account disabled' };
    }

    const passwordValid = await this.verifyPassword(input.password, user.passwordHash, user.salt);
    if (!passwordValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Create session & token
    const now = Date.now();
    const sessionId = crypto.randomUUID();
    const token = this.createJwt({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      sid: sessionId,
      iat: Math.floor(now / 1000),
      exp: Math.floor(now / 1000) + this.config.tokenExpirySec,
    });

    const session: StoredSession = {
      id: sessionId,
      userId: user.id,
      token,
      createdAt: now,
      expiresAt: now + this.config.sessionExpirySec * 1000,
      lastActivityAt: now,
    };

    this.saveSession(session);

    return {
      success: true,
      user: this.toAuthUser(user),
      session: this.toAuthSession(session),
      token,
    };
  }

  async signOut(sessionId: string): Promise<void> {
    const sessions = this.loadSessions().filter(s => s.id !== sessionId);
    this.saveSessions(sessions);
  }

  async verify(token: string): Promise<{ user: AuthUser; session: AuthSession } | null> {
    const payload = this.verifyJwt(token);
    if (!payload) return null;

    const now = Date.now();
    const sessions = this.loadSessions();
    const session = sessions.find(s => s.id === payload.sid && s.expiresAt > now);
    if (!session) return null;

    const users = this.loadUsers();
    const user = users.find(u => u.id === payload.sub);
    if (!user || user.disabled) return null;

    // Update last activity
    session.lastActivityAt = now;
    this.saveSessions(sessions);

    return {
      user: this.toAuthUser(user),
      session: this.toAuthSession(session),
    };
  }

  async getUser(userId: string): Promise<AuthUser | null> {
    const users = this.loadUsers();
    const user = users.find(u => u.id === userId);
    return user ? this.toAuthUser(user) : null;
  }

  async createUser(input: {
    email: string;
    password: string;
    name?: string;
    roles?: string[];
  }): Promise<AuthUser> {
    const users = this.loadUsers();

    if (users.some(u => u.email === input.email)) {
      throw new Error(`User with email ${input.email} already exists`);
    }

    const salt = crypto.randomBytes(32).toString('hex');
    const passwordHash = await this.hashPassword(input.password, salt);
    const now = Date.now();

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      email: input.email,
      name: input.name,
      passwordHash,
      salt,
      roles: input.roles ?? ['user'],
      createdAt: now,
      updatedAt: now,
      disabled: false,
    };

    users.push(newUser);
    this.saveUsers(users);

    return this.toAuthUser(newUser);
  }

  async healthcheck(): Promise<AuthHealth> {
    try {
      const users = this.loadUsers();
      const sessions = this.loadSessions();
      const activeSessions = sessions.filter(s => s.expiresAt > Date.now());

      return {
        healthy: true,
        mode: 'native',
        provider: this.providerId,
        details: {
          userCount: users.length,
          totalSessions: sessions.length,
          activeSessions: activeSessions.length,
          dataDir: this.config.dataDir,
        },
      };
    } catch (err) {
      return {
        healthy: false,
        mode: 'native',
        provider: this.providerId,
        details: { error: String(err) },
      };
    }
  }

  async close(): Promise<void> {
    // Cleanup expired sessions on close
    const now = Date.now();
    const sessions = this.loadSessions().filter(s => s.expiresAt > now);
    this.saveSessions(sessions);
  }

  // ── Private: Password Hashing ─────────────────────────────────────────────

  private hashPassword(password: string, salt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.scrypt(password, salt, 64, (err, derivedKey) => {
        if (err) reject(err);
        else resolve(derivedKey.toString('hex'));
      });
    });
  }

  private async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    const derived = await this.hashPassword(password, salt);
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
  }

  // ── Private: JWT (HMAC-SHA256, no external dependency) ────────────────────

  private createJwt(payload: Record<string, unknown>): string {
    const header = this.base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = this.base64url(JSON.stringify(payload));
    const signature = this.sign(`${header}.${body}`);
    return `${header}.${body}.${signature}`;
  }

  private verifyJwt(token: string): any | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const [header, body, signature] = parts;
      const expectedSig = this.sign(`${header}.${body}`);

      if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
        return null;
      }

      const payload = JSON.parse(Buffer.from(body, 'base64url').toString());

      // Check expiration
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  private sign(data: string): string {
    return crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(data)
      .digest('base64url');
  }

  private base64url(str: string): string {
    return Buffer.from(str).toString('base64url');
  }

  // ── Private: File I/O ─────────────────────────────────────────────────────

  private loadUsers(): StoredUser[] {
    try {
      return JSON.parse(fs.readFileSync(this.usersFile, 'utf-8'));
    } catch {
      return [];
    }
  }

  private saveUsers(users: StoredUser[]): void {
    fs.writeFileSync(this.usersFile, JSON.stringify(users, null, 2), { mode: 0o600 });
  }

  private loadSessions(): StoredSession[] {
    try {
      return JSON.parse(fs.readFileSync(this.sessionsFile, 'utf-8'));
    } catch {
      return [];
    }
  }

  private saveSessions(sessions: StoredSession[]): void {
    fs.writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2), { mode: 0o600 });
  }

  private saveSession(session: StoredSession): void {
    const sessions = this.loadSessions();
    sessions.push(session);
    this.saveSessions(sessions);
  }

  private toAuthUser(stored: StoredUser): AuthUser {
    return {
      id: stored.id,
      email: stored.email,
      name: stored.name,
      roles: stored.roles,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      disabled: stored.disabled,
    };
  }

  private toAuthSession(stored: StoredSession): AuthSession {
    return {
      id: stored.id,
      userId: stored.userId,
      createdAt: stored.createdAt,
      expiresAt: stored.expiresAt,
      lastActivityAt: stored.lastActivityAt,
    };
  }
}