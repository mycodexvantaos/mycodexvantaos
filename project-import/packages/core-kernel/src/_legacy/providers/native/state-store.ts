/**
 * NativeStateStoreProvider — In-memory key-value store with file persistence
 * 
 * Zero external dependencies. Replaces ALL hard Redis dependencies.
 *  - In-memory Map with TTL support
 *  - Periodic file-based snapshots for crash recovery
 *  - Process-level mutex for distributed lock semantics (single-node)
 *  - Glob-pattern scanning, atomic counters, batch ops
 */

import type {
  StateStoreProvider,
  StateEntry,
  SetOptions,
  ScanOptions,
  ScanResult,
  LockHandle,
  StateStoreHealth,
} from '../../interfaces/state-store';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface NativeStateStoreConfig {
  dataDir?: string;
  snapshotFile?: string;
  snapshotIntervalMs?: number;
  defaultTtlSec?: number;
}

interface InternalEntry {
  key: string;
  value: unknown;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;   // null = no expiry
  version: number;
}

interface InternalLock {
  lockId: string;
  resource: string;
  acquiredAt: number;
  expiresAt: number;
}

export class NativeStateStoreProvider implements StateStoreProvider {
  readonly providerId = 'native-memory-kv';
  readonly mode = 'native' as const;

  private config: Required<NativeStateStoreConfig>;
  private store = new Map<string, InternalEntry>();
  private locks = new Map<string, InternalLock>();
  private snapshotTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config?: NativeStateStoreConfig) {
    const dataDir = config?.dataDir ?? path.join(process.cwd(), '.codexvanta', 'state');
    this.config = {
      dataDir,
      snapshotFile: config?.snapshotFile ?? path.join(dataDir, 'state-snapshot.json'),
      snapshotIntervalMs: config?.snapshotIntervalMs ?? 10000,
      defaultTtlSec: config?.defaultTtlSec ?? 0,
    };
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }

    // Restore from snapshot
    if (fs.existsSync(this.config.snapshotFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.config.snapshotFile, 'utf-8'));
        const now = Date.now();
        for (const entry of data as InternalEntry[]) {
          // Skip expired entries
          if (entry.expiresAt !== null && entry.expiresAt <= now) continue;
          this.store.set(entry.key, entry);
        }
      } catch {
        // Corrupted snapshot, start fresh
      }
    }

    // Start snapshot timer
    this.snapshotTimer = setInterval(() => this.snapshot(), this.config.snapshotIntervalMs);
  }

  // ── Basic CRUD ──────────────────────────────────────────────────────────────

  async get<T = unknown>(key: string): Promise<StateEntry<T> | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Check TTL
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return this.toStateEntry<T>(entry);
  }

  async set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<StateEntry<T>> {
    const now = Date.now();
    const existing = this.store.get(key);

    // Conditional checks
    if (options?.ifNotExists && existing && (existing.expiresAt === null || existing.expiresAt > now)) {
      throw new Error(`Key already exists: ${key}`);
    }
    if (options?.ifExists && (!existing || (existing.expiresAt !== null && existing.expiresAt <= now))) {
      throw new Error(`Key does not exist: ${key}`);
    }
    if (options?.version !== undefined && existing && existing.version !== options.version) {
      throw new Error(`Version conflict: expected ${options.version}, got ${existing.version}`);
    }

    const ttlSec = options?.ttl ?? this.config.defaultTtlSec;

    const entry: InternalEntry = {
      key,
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      expiresAt: ttlSec > 0 ? now + ttlSec * 1000 : null,
      version: (existing?.version ?? 0) + 1,
    };

    this.store.set(key, entry);
    return this.toStateEntry<T>(entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  // ── Batch Operations ────────────────────────────────────────────────────────

  async mget<T = unknown>(keys: string[]): Promise<Map<string, StateEntry<T>>> {
    const result = new Map<string, StateEntry<T>>();
    for (const key of keys) {
      const entry = await this.get<T>(key);
      if (entry) result.set(key, entry);
    }
    return result;
  }

  async mset<T = unknown>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    for (const { key, value, ttl } of entries) {
      await this.set(key, value, ttl ? { ttl } : undefined);
    }
  }

  async mdelete(keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.delete(key)) count++;
    }
    return count;
  }

  // ── Scan / Iteration ────────────────────────────────────────────────────────

  async scan<T = unknown>(options?: ScanOptions): Promise<ScanResult<T>> {
    const pattern = options?.pattern ?? '*';
    const count = options?.count ?? 100;
    const cursorKey = options?.cursor;
    const now = Date.now();

    const regex = this.globToRegex(pattern);
    const allKeys = Array.from(this.store.keys())
      .filter(k => regex.test(k))
      .sort();

    let startIdx = 0;
    if (cursorKey) {
      const idx = allKeys.indexOf(cursorKey);
      startIdx = idx >= 0 ? idx + 1 : 0;
    }

    const pageKeys = allKeys.slice(startIdx, startIdx + count);
    const entries: StateEntry<T>[] = [];

    for (const key of pageKeys) {
      const internal = this.store.get(key);
      if (!internal) continue;
      if (internal.expiresAt !== null && internal.expiresAt <= now) {
        this.store.delete(key);
        continue;
      }
      entries.push(this.toStateEntry<T>(internal));
    }

    const hasMore = startIdx + count < allKeys.length;

    return {
      entries,
      nextCursor: hasMore ? pageKeys[pageKeys.length - 1] : undefined,
    };
  }

  // ── Atomic Counters ─────────────────────────────────────────────────────────

  async increment(key: string, delta: number = 1): Promise<number> {
    const entry = this.store.get(key);
    const now = Date.now();

    let currentValue = 0;
    if (entry && (entry.expiresAt === null || entry.expiresAt > now)) {
      if (typeof entry.value !== 'number') {
        throw new Error(`Value at key ${key} is not a number`);
      }
      currentValue = entry.value as number;
    }

    const newValue = currentValue + delta;
    await this.set(key, newValue);
    return newValue;
  }

  // ── Distributed Locking ─────────────────────────────────────────────────────

  async acquireLock(
    resource: string,
    ttlSec: number,
    timeoutSec: number = 5
  ): Promise<LockHandle | null> {
    const deadline = Date.now() + timeoutSec * 1000;
    const pollMs = 50;

    while (Date.now() < deadline) {
      const now = Date.now();
      const existing = this.locks.get(resource);

      // Check if lock is free or expired
      if (!existing || existing.expiresAt <= now) {
        const lockId = crypto.randomUUID();
        const lock: InternalLock = {
          lockId,
          resource,
          acquiredAt: now,
          expiresAt: now + ttlSec * 1000,
        };
        this.locks.set(resource, lock);

        return {
          lockId,
          resource,
          acquiredAt: now,
          expiresAt: lock.expiresAt,
          release: async () => {
            const current = this.locks.get(resource);
            if (current?.lockId === lockId) {
              this.locks.delete(resource);
            }
          },
          extend: async (additionalSec: number) => {
            const current = this.locks.get(resource);
            if (current?.lockId === lockId) {
              current.expiresAt = Date.now() + additionalSec * 1000;
            }
          },
        };
      }

      // Wait and retry
      await new Promise(resolve => setTimeout(resolve, pollMs));
    }

    return null; // Timeout
  }

  // ── Pub/Sub ─────────────────────────────────────────────────────────────────

  private channels = new Map<string, Set<(message: unknown) => void>>();

  async publish(channel: string, message: unknown): Promise<number> {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) return 0;

    for (const handler of subscribers) {
      try {
        handler(message);
      } catch {
        // Best-effort delivery
      }
    }
    return subscribers.size;
  }

  async subscribe(
    channel: string,
    handler: (message: unknown) => void
  ): Promise<{ unsubscribe(): Promise<void> }> {
    let subs = this.channels.get(channel);
    if (!subs) {
      subs = new Set();
      this.channels.set(channel, subs);
    }
    subs.add(handler);

    return {
      unsubscribe: async () => {
        subs!.delete(handler);
        if (subs!.size === 0) this.channels.delete(channel);
      },
    };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async healthcheck(): Promise<StateStoreHealth> {
    const now = Date.now();
    let activeKeys = 0;
    let expiredKeys = 0;

    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && entry.expiresAt <= now) {
        expiredKeys++;
      } else {
        activeKeys++;
      }
    }

    // Rough memory estimate
    const memoryUsageBytes = JSON.stringify(Array.from(this.store.values())).length;

    return {
      healthy: true,
      mode: 'native',
      provider: this.providerId,
      keyCount: activeKeys,
      memoryUsageBytes,
      details: {
        expiredKeys,
        activeLocks: this.locks.size,
        pubsubChannels: this.channels.size,
        dataDir: this.config.dataDir,
      },
    };
  }

  async close(): Promise<void> {
    if (this.snapshotTimer) {
      clearInterval(this.snapshotTimer);
      this.snapshotTimer = null;
    }
    this.snapshot();
    this.store.clear();
    this.locks.clear();
    this.channels.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private snapshot(): void {
    try {
      const entries = Array.from(this.store.values());
      fs.writeFileSync(this.config.snapshotFile, JSON.stringify(entries, null, 2));
    } catch {
      // Best-effort
    }
  }

  private toStateEntry<T>(internal: InternalEntry): StateEntry<T> {
    const now = Date.now();
    return {
      key: internal.key,
      value: internal.value as T,
      ttl: internal.expiresAt !== null
        ? Math.max(0, Math.floor((internal.expiresAt - now) / 1000))
        : undefined,
      createdAt: internal.createdAt,
      updatedAt: internal.updatedAt,
      version: internal.version,
    };
  }

  private globToRegex(pattern: string): RegExp {
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(`^${escaped}$`);
  }
}