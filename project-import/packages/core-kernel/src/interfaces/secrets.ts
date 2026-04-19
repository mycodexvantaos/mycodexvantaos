/**
 * CodexvantaOS — SecretsProvider
 * 
 * Abstract interface for secrets / sensitive configuration management.
 * Native mode: encrypted file-based vault (zero dependencies)
 * External mode: GitHub Secrets, HashiCorp Vault, AWS Secrets Manager,
 *                Azure Key Vault, GCP Secret Manager, etc.
 * 
 * Design principles:
 *  - Secrets are NEVER logged or included in error messages
 *  - All secrets are namespaced by scope (global / repo / environment)
 *  - Rotation support is built into the interface
 *  - Audit trail for every access
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type SecretScope = 'global' | 'repository' | 'environment' | 'user';

export interface SecretMeta {
  key: string;
  scope: SecretScope;
  namespace?: string;       // e.g. repo name, env name
  createdAt: number;        // epoch ms
  updatedAt: number;
  rotatedAt?: number;       // last rotation timestamp
  expiresAt?: number;       // optional expiry
  version: number;
  tags?: Record<string, string>;
}

export interface SecretValue {
  meta: SecretMeta;
  value: string;            // always decrypted when returned
}

export interface SetSecretOptions {
  scope?: SecretScope;
  namespace?: string;
  expiresAt?: number;
  tags?: Record<string, string>;
  overwrite?: boolean;      // default true
}

export interface ListSecretsOptions {
  scope?: SecretScope;
  namespace?: string;
  prefix?: string;
  tags?: Record<string, string>;
  includeExpired?: boolean;
}

export interface RotateResult {
  key: string;
  previousVersion: number;
  newVersion: number;
  rotatedAt: number;
}

export interface SecretAuditEntry {
  timestamp: number;
  action: 'get' | 'set' | 'delete' | 'rotate' | 'list';
  key?: string;
  scope?: SecretScope;
  namespace?: string;
  actor?: string;           // principal performing the action
  success: boolean;
  reason?: string;          // failure reason if !success
}

export interface SecretsHealth {
  healthy: boolean;
  mode: 'native' | 'external';
  provider: string;
  encrypted: boolean;       // whether at-rest encryption is active
  secretCount?: number;
  oldestSecret?: number;    // epoch ms
  expiringWithin24h?: number;
  details?: Record<string, unknown>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SecretsProvider {
  readonly providerId: string;
  readonly mode: 'native' | 'external';

  /** Initialise vault / connection. In native mode, loads & decrypts local vault file. */
  init(): Promise<void>;

  // ── CRUD ────────────────────────────────────────────────────────────────

  /** Retrieve a secret value. Returns null if not found or expired. */
  get(key: string, scope?: SecretScope, namespace?: string): Promise<SecretValue | null>;

  /** Store or update a secret. Value is encrypted at rest. */
  set(key: string, value: string, options?: SetSecretOptions): Promise<SecretMeta>;

  /** Delete a secret. Returns true if it existed. */
  delete(key: string, scope?: SecretScope, namespace?: string): Promise<boolean>;

  /** Check if a secret exists without retrieving its value. */
  exists(key: string, scope?: SecretScope, namespace?: string): Promise<boolean>;

  // ── Listing (metadata only — never exposes values in bulk) ──────────────

  /** List secret metadata matching filters. NEVER returns values. */
  list(options?: ListSecretsOptions): Promise<SecretMeta[]>;

  // ── Rotation ────────────────────────────────────────────────────────────

  /**
   * Rotate a secret: generate a new value via the supplied generator,
   * store it, and return rotation metadata.
   * If no generator is provided, the caller must supply newValue.
   */
  rotate(
    key: string,
    newValue: string,
    scope?: SecretScope,
    namespace?: string
  ): Promise<RotateResult>;

  // ── Audit ───────────────────────────────────────────────────────────────

  /** Retrieve recent audit entries. Native mode stores in local encrypted log. */
  auditLog?(options?: {
    key?: string;
    scope?: SecretScope;
    since?: number;
    limit?: number;
  }): Promise<SecretAuditEntry[]>;

  // ── Bulk Operations ─────────────────────────────────────────────────────

  /** Resolve multiple secrets in one call. Returns a map of key→value. */
  resolveMany?(
    keys: Array<{ key: string; scope?: SecretScope; namespace?: string }>
  ): Promise<Map<string, string>>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  healthcheck(): Promise<SecretsHealth>;
  close(): Promise<void>;
}