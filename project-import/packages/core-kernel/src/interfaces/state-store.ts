/**
 * CodexvantaOS — StateStoreProvider
 * 
 * Abstract interface for key-value state management.
 * Native mode: in-memory / file-based store (zero dependencies)
 * External mode: Redis, Memcached, DynamoDB, etc.
 * 
 * This interface replaces ALL hard Redis dependencies across the platform.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StateEntry<T = unknown> {
  key: string;
  value: T;
  ttl?: number;           // remaining TTL in seconds, undefined = no expiry
  createdAt: number;       // epoch ms
  updatedAt: number;       // epoch ms
  version: number;         // optimistic concurrency control
}

export interface SetOptions {
  ttl?: number;            // time-to-live in seconds
  ifNotExists?: boolean;   // SET NX semantics
  ifExists?: boolean;      // SET XX semantics
  version?: number;        // optimistic lock — fail if current version ≠ this
}

export interface ScanOptions {
  pattern?: string;        // glob-style pattern, e.g. "orchestrator:*"
  cursor?: string;         // pagination cursor
  count?: number;          // hint for batch size
}

export interface ScanResult<T = unknown> {
  entries: StateEntry<T>[];
  nextCursor?: string;     // undefined = no more results
}

export interface LockHandle {
  lockId: string;
  resource: string;
  acquiredAt: number;
  expiresAt: number;
  release(): Promise<void>;
  extend(additionalSec: number): Promise<void>;
}

export interface StateStoreHealth {
  healthy: boolean;
  mode: 'native' | 'external';
  provider: string;
  latencyMs?: number;
  keyCount?: number;
  memoryUsageBytes?: number;
  details?: Record<string, unknown>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface StateStoreProvider {
  readonly providerId: string;
  readonly mode: 'native' | 'external';

  /** Initialise connection / in-memory structures */
  init(): Promise<void>;

  // ── Basic CRUD ──────────────────────────────────────────────────────────

  /** Get a value by key. Returns null if key does not exist or has expired. */
  get<T = unknown>(key: string): Promise<StateEntry<T> | null>;

  /** Set a value. Returns the stored entry (with version). */
  set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<StateEntry<T>>;

  /** Delete a key. Returns true if key existed. */
  delete(key: string): Promise<boolean>;

  /** Check existence without retrieving value. */
  exists(key: string): Promise<boolean>;

  // ── Batch Operations ────────────────────────────────────────────────────

  /** Get multiple keys in one round-trip. Missing keys are omitted. */
  mget<T = unknown>(keys: string[]): Promise<Map<string, StateEntry<T>>>;

  /** Set multiple keys atomically. */
  mset<T = unknown>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void>;

  /** Delete multiple keys. Returns count of keys actually removed. */
  mdelete(keys: string[]): Promise<number>;

  // ── Scan / Iteration ────────────────────────────────────────────────────

  /** Iterate keys matching a pattern (cursor-based pagination). */
  scan<T = unknown>(options?: ScanOptions): Promise<ScanResult<T>>;

  // ── Atomic Counters ─────────────────────────────────────────────────────

  /** Atomically increment a numeric value. Returns new value. */
  increment(key: string, delta?: number): Promise<number>;

  // ── Distributed Locking ─────────────────────────────────────────────────

  /**
   * Acquire a distributed lock on a resource.
   * Native mode: process-level mutex (single-node safe).
   * External mode: Redis Redlock / provider-specific DLM.
   * Returns null if lock could not be acquired within timeoutSec.
   */
  acquireLock(resource: string, ttlSec: number, timeoutSec?: number): Promise<LockHandle | null>;

  // ── Pub/Sub (optional) ──────────────────────────────────────────────────

  /** Publish a message to a channel. Optional — not all backends support it. */
  publish?(channel: string, message: unknown): Promise<number>;

  /** Subscribe to a channel. Returns an unsubscribe handle. */
  subscribe?(channel: string, handler: (message: unknown) => void): Promise<{ unsubscribe(): Promise<void> }>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  healthcheck(): Promise<StateStoreHealth>;
  close(): Promise<void>;
}