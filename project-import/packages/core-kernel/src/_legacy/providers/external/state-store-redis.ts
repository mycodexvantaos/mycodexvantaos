import { randomUUID } from 'node:crypto';
/**
 * RedisStateStoreProvider — External Redis-based state store
 * 
 * Example external provider showing how Redis plugs into
 * the StateStoreProvider interface as an OPTIONAL connector.
 * 
 * The platform works without this via NativeStateStoreProvider (in-memory).
 * 
 * Install dependencies:
 *   npm install ioredis
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

interface RedisStateStoreConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  tls?: boolean;
}

export class RedisStateStoreProvider implements StateStoreProvider {
  readonly providerId = 'external-redis';
  readonly mode = 'external' as const;

  private client: any = null;
  private config: RedisStateStoreConfig;
  private prefix: string;

  constructor(config: RedisStateStoreConfig) {
    this.config = config;
    this.prefix = config.keyPrefix ?? 'cvos:';
  }

  async init(): Promise<void> {
    const Redis = (await import('ioredis')).default;
    this.client = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db ?? 0,
      tls: this.config.tls ? {} : undefined,
      keyPrefix: this.prefix,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    });

    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      this.client.once('ready', resolve);
      this.client.once('error', reject);
      setTimeout(() => reject(new Error('Redis connection timeout')), 10000);
    });
  }

  async get<T = unknown>(key: string): Promise<StateEntry<T> | null> {
    const raw = await this.client.get(key);
    if (raw === null) return null;

    try {
      const stored = JSON.parse(raw);
      const ttl = await this.client.ttl(this.prefix + key);
      return {
        key,
        value: stored.value as T,
        ttl: ttl > 0 ? ttl : undefined,
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
        version: stored.version,
      };
    } catch {
      return null;
    }
  }

  async set<T = unknown>(key: string, value: T, options?: SetOptions): Promise<StateEntry<T>> {
    const now = Date.now();
    const existing = await this.get<T>(key);

    if (options?.ifNotExists && existing) throw new Error(`Key already exists: ${key}`);
    if (options?.ifExists && !existing) throw new Error(`Key does not exist: ${key}`);
    if (options?.version !== undefined && existing && existing.version !== options.version) {
      throw new Error(`Version conflict: expected ${options.version}, got ${existing.version}`);
    }

    const stored = {
      value,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      version: (existing?.version ?? 0) + 1,
    };

    const serialized = JSON.stringify(stored);

    if (options?.ttl) {
      await this.client.setex(key, options.ttl, serialized);
    } else {
      await this.client.set(key, serialized);
    }

    return {
      key,
      value,
      ttl: options?.ttl,
      createdAt: stored.createdAt,
      updatedAt: stored.updatedAt,
      version: stored.version,
    };
  }

  async delete(key: string): Promise<boolean> {
    const result = await this.client.del(key);
    return result > 0;
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) > 0;
  }

  async mget<T = unknown>(keys: string[]): Promise<Map<string, StateEntry<T>>> {
    const result = new Map<string, StateEntry<T>>();
    if (keys.length === 0) return result;

    const values = await this.client.mget(...keys);
    for (let i = 0; i < keys.length; i++) {
      if (values[i] !== null) {
        try {
          const stored = JSON.parse(values[i]);
          result.set(keys[i], {
            key: keys[i],
            value: stored.value as T,
            createdAt: stored.createdAt,
            updatedAt: stored.updatedAt,
            version: stored.version,
          });
        } catch { /* skip invalid */ }
      }
    }
    return result;
  }

  async mset<T = unknown>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const pipeline = this.client.pipeline();
    const now = Date.now();

    for (const { key, value, ttl } of entries) {
      const stored = JSON.stringify({ value, createdAt: now, updatedAt: now, version: 1 });
      if (ttl) {
        pipeline.setex(key, ttl, stored);
      } else {
        pipeline.set(key, stored);
      }
    }

    await pipeline.exec();
  }

  async mdelete(keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return await this.client.del(...keys);
  }

  async scan<T = unknown>(options?: ScanOptions): Promise<ScanResult<T>> {
    const pattern = options?.pattern ?? '*';
    const count = options?.count ?? 100;
    const cursor = options?.cursor ?? '0';

    const [nextCursor, keys] = await this.client.scan(
      cursor, 'MATCH', pattern, 'COUNT', count
    );

    const entries: StateEntry<T>[] = [];
    if (keys.length > 0) {
      const values = await this.client.mget(...keys);
      for (let i = 0; i < keys.length; i++) {
        if (values[i] !== null) {
          try {
            const stored = JSON.parse(values[i]);
            // Remove prefix from key for display
            const cleanKey = keys[i].startsWith(this.prefix)
              ? keys[i].slice(this.prefix.length) : keys[i];
            entries.push({
              key: cleanKey,
              value: stored.value as T,
              createdAt: stored.createdAt,
              updatedAt: stored.updatedAt,
              version: stored.version,
            });
          } catch { /* skip */ }
        }
      }
    }

    return {
      entries,
      nextCursor: nextCursor !== '0' ? nextCursor : undefined,
    };
  }

  async increment(key: string, delta: number = 1): Promise<number> {
    if (delta === 1) return await this.client.incr(key);
    return await this.client.incrby(key, delta);
  }

  async acquireLock(
    resource: string,
    ttlSec: number,
    timeoutSec: number = 5
  ): Promise<LockHandle | null> {
    const lockKey = `_lock:${resource}`;
    const lockId = randomUUID().replace(/-/g, '') + Date.now().toString(36);
    const deadline = Date.now() + timeoutSec * 1000;

    while (Date.now() < deadline) {
      const acquired = await this.client.set(lockKey, lockId, 'EX', ttlSec, 'NX');
      if (acquired === 'OK') {
        const now = Date.now();
        return {
          lockId,
          resource,
          acquiredAt: now,
          expiresAt: now + ttlSec * 1000,
          release: async () => {
            // Lua script for atomic check-and-delete
            const script = `
              if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
              else return 0 end
            `;
            await this.client.eval(script, 1, this.prefix + lockKey, lockId);
          },
          extend: async (additionalSec: number) => {
            const script = `
              if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("expire", KEYS[1], ARGV[2])
              else return 0 end
            `;
            await this.client.eval(script, 1, this.prefix + lockKey, lockId, additionalSec);
          },
        };
      }

      await new Promise(r => setTimeout(r, 50));
    }

    return null;
  }

  async publish(channel: string, message: unknown): Promise<number> {
    return await this.client.publish(channel, JSON.stringify(message));
  }

  async subscribe(
    channel: string,
    handler: (message: unknown) => void
  ): Promise<{ unsubscribe(): Promise<void> }> {
    const Redis = (await import('ioredis')).default;
    const sub = new Redis({
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db ?? 0,
      tls: this.config.tls ? {} : undefined,
    });

    sub.subscribe(channel);
    sub.on('message', (_ch: string, msg: string) => {
      try { handler(JSON.parse(msg)); }
      catch { handler(msg); }
    });

    return {
      unsubscribe: async () => {
        sub.unsubscribe(channel);
        sub.disconnect();
      },
    };
  }

  async healthcheck(): Promise<StateStoreHealth> {
    const start = Date.now();
    try {
      const info = await this.client.info('memory');
      const memMatch = info.match(/used_memory:(\d+)/);
      const keysInfo = await this.client.dbsize();

      return {
        healthy: true,
        mode: 'external',
        provider: this.providerId,
        latencyMs: Date.now() - start,
        keyCount: keysInfo,
        memoryUsageBytes: memMatch ? parseInt(memMatch[1]) : undefined,
        details: { host: this.config.host, port: this.config.port },
      };
    } catch (err) {
      return {
        healthy: false,
        mode: 'external',
        provider: this.providerId,
        latencyMs: Date.now() - start,
        details: { error: String(err) },
      };
    }
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }
}