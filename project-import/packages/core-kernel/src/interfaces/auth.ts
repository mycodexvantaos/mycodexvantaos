/**
 * AuthProvider Interface
 *
 * Abstraction for authentication and session management.
 * Platform MUST provide a native implementation (session auth).
 * External providers (OAuth, Auth0, Keycloak) are optional connectors.
 *
 * @layer Layer C (Native Services) + Layer D (Connector)
 */

export interface AuthUser {
  userId: string;
  email?: string;
  displayName?: string;
  avatarUrl?: string;
  roles?: string[];
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  lastLoginAt?: Date;
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  expiresAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SignInInput {
  method: 'email' | 'token' | 'oauth' | 'api-key' | 'session';
  credentials: Record<string, string>;
}

export interface SignInResult {
  user: AuthUser;
  session: AuthSession;
  token: string;
}

export interface AuthHealth {
  available: boolean;
  provider: string;
  activeSessions?: number;
}

export interface AuthProvider {
  /** Unique provider identifier */
  readonly providerId: string;

  /** Provider mode: 'native' | 'external' */
  readonly mode: 'native' | 'external';

  /** Initialize auth backend */
  init(): Promise<void>;

  /** Sign in a user */
  signIn(input: SignInInput): Promise<SignInResult>;

  /** Sign out (invalidate session) */
  signOut(sessionId: string): Promise<void>;

  /** Verify a session token and return user context */
  verify(token: string): Promise<{ user: AuthUser; session: AuthSession } | null>;

  /** Get user by ID */
  getUser(userId: string): Promise<AuthUser | null>;

  /** Create a new user (native mode) */
  createUser?(input: { email: string; displayName?: string; password?: string }): Promise<AuthUser>;

  /** Update user profile */
  updateUser?(userId: string, updates: Partial<AuthUser>): Promise<AuthUser>;

  /** Delete user */
  deleteUser?(userId: string): Promise<void>;

  /** List active sessions for a user */
  listSessions?(userId: string): Promise<AuthSession[]>;

  /** Refresh a token */
  refreshToken?(token: string): Promise<{ token: string; expiresAt: Date }>;

  /** Health check */
  healthcheck(): Promise<AuthHealth>;

  /** Graceful shutdown */
  close(): Promise<void>;
}