/**
 * NativeQueueProvider — In-memory + file-persisted job queue
 * 
 * Zero external dependencies. Implements async task queuing using:
 *  - In-memory priority queue for hot processing
 *  - File-based persistence for crash recovery
 *  - Simple polling-based consumer model
 *  - No Redis, no RabbitMQ, no SQS required
 */

import type {
  QueueProvider,
  QueueMessage,
  QueueStats,
  EnqueueOptions,
  QueueHealth,
} from '../../interfaces/queue';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface NativeQueueConfig {
  dataDir?: string;
  maxRetries?: number;
  defaultVisibilityTimeout?: number;  // seconds
  persistInterval?: number;           // ms — how often to flush to disk
}

interface InternalMessage<T = unknown> {
  id: string;
  topic: string;
  payload: T;
  priority: number;
  enqueuedAt: number;
  visibleAfter: number;
  attempts: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  lastError?: string;
}

export class NativeQueueProvider implements QueueProvider {
  readonly providerId = 'native-memory-queue';
  readonly mode = 'native' as const;

  private config: Required<NativeQueueConfig>;
  private queues = new Map<string, InternalMessage[]>();
  private persistTimer: ReturnType<typeof setInterval> | null = null;
  private subscribers = new Map<string, Array<(msg: QueueMessage) => Promise<void>>>();

  constructor(config?: NativeQueueConfig) {
    this.config = {
      dataDir: config?.dataDir ?? path.join(process.cwd(), '.codexvanta', 'queue'),
      maxRetries: config?.maxRetries ?? 3,
      defaultVisibilityTimeout: config?.defaultVisibilityTimeout ?? 30,
      persistInterval: config?.persistInterval ?? 5000,
    };
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.config.dataDir)) {
      fs.mkdirSync(this.config.dataDir, { recursive: true });
    }

    // Restore persisted queues
    const files = fs.readdirSync(this.config.dataDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const topic = path.basename(file, '.json');
      try {
        const data = JSON.parse(fs.readFileSync(path.join(this.config.dataDir, file), 'utf-8'));
        // Only restore non-completed messages
        const active = data.filter((m: InternalMessage) => m.status !== 'completed');
        // Reset processing messages back to pending
        for (const msg of active) {
          if (msg.status === 'processing') {
            msg.status = 'pending';
            msg.visibleAfter = Date.now();
          }
        }
        this.queues.set(topic, active);
      } catch {
        // Corrupted file, start fresh
        this.queues.set(topic, []);
      }
    }

    // Start persistence timer
    this.persistTimer = setInterval(() => this.persistAll(), this.config.persistInterval);
  }

  async enqueue<T = unknown>(
    topic: string,
    payload: T,
    options?: EnqueueOptions
  ): Promise<string> {
    const queue = this.getOrCreateQueue(topic);
    const now = Date.now();

    const msg: InternalMessage<T> = {
      id: crypto.randomUUID(),
      topic,
      payload,
      priority: options?.priority ?? 0,
      enqueuedAt: now,
      visibleAfter: options?.delay ? now + options.delay * 1000 : now,
      attempts: 0,
      maxRetries: options?.maxRetries ?? this.config.maxRetries,
      status: 'pending',
    };

    queue.push(msg);
    // Sort by priority (higher first), then by enqueue time
    queue.sort((a, b) => b.priority - a.priority || a.enqueuedAt - b.enqueuedAt);

    // Notify subscribers
    this.notifySubscribers(topic);

    return msg.id;
  }

  async dequeue<T = unknown>(topic: string): Promise<QueueMessage<T> | null> {
    const queue = this.queues.get(topic);
    if (!queue || queue.length === 0) return null;

    const now = Date.now();
    const idx = queue.findIndex(m => m.status === 'pending' && m.visibleAfter <= now);
    if (idx === -1) return null;

    const msg = queue[idx];
    msg.status = 'processing';
    msg.attempts++;
    msg.visibleAfter = now + this.config.defaultVisibilityTimeout * 1000;

    return {
      id: msg.id,
      topic: msg.topic,
      payload: msg.payload as T,
      enqueuedAt: msg.enqueuedAt,
      attempts: msg.attempts,
      metadata: { priority: msg.priority },
    };
  }

  async ack(topic: string, messageId: string): Promise<void> {
    const queue = this.queues.get(topic);
    if (!queue) return;

    const idx = queue.findIndex(m => m.id === messageId);
    if (idx !== -1) {
      queue[idx].status = 'completed';
      // Remove completed messages
      queue.splice(idx, 1);
    }
  }

  async retry(topic: string, messageId: string, delay?: number): Promise<void> {
    const queue = this.queues.get(topic);
    if (!queue) return;

    const msg = queue.find(m => m.id === messageId);
    if (!msg) return;

    if (msg.attempts >= msg.maxRetries) {
      msg.status = 'failed';
      msg.lastError = 'Max retries exceeded';
      return;
    }

    msg.status = 'pending';
    msg.visibleAfter = Date.now() + (delay ?? 5) * 1000;
  }

  async fail(topic: string, messageId: string, reason?: string): Promise<void> {
    const queue = this.queues.get(topic);
    if (!queue) return;

    const msg = queue.find(m => m.id === messageId);
    if (msg) {
      msg.status = 'failed';
      msg.lastError = reason;
    }
  }

  async size(topic: string): Promise<number> {
    const queue = this.queues.get(topic);
    if (!queue) return 0;
    return queue.filter(m => m.status === 'pending' || m.status === 'processing').length;
  }

  async stats(topic: string): Promise<QueueStats> {
    const queue = this.queues.get(topic) ?? [];
    const now = Date.now();

    const pending = queue.filter(m => m.status === 'pending' && m.visibleAfter <= now).length;
    const delayed = queue.filter(m => m.status === 'pending' && m.visibleAfter > now).length;
    const processing = queue.filter(m => m.status === 'processing').length;
    const failed = queue.filter(m => m.status === 'failed').length;

    return {
      topic,
      pending,
      delayed,
      processing,
      failed,
      total: queue.length,
    };
  }

  async subscribe<T>(
    topic: string,
    handler: (msg: QueueMessage<T>) => Promise<void>,
    options?: { pollIntervalMs?: number; batchSize?: number }
  ): Promise<{ unsubscribe(): Promise<void> }> {
    const handlers = this.subscribers.get(topic) ?? [];
    handlers.push(handler as (msg: QueueMessage) => Promise<void>);
    this.subscribers.set(topic, handlers);

    // Start polling loop
    const pollInterval = options?.pollIntervalMs ?? 1000;
    let active = true;

    const poll = async () => {
      while (active) {
        try {
          const msg = await this.dequeue<T>(topic);
          if (msg) {
            try {
              await handler(msg);
              await this.ack(topic, msg.id);
            } catch (err) {
              await this.retry(topic, msg.id);
            }
          }
        } catch {
          // Ignore polling errors
        }
        await this.sleep(pollInterval);
      }
    };

    // Start polling in background (non-blocking)
    poll();

    return {
      unsubscribe: async () => {
        active = false;
        const h = this.subscribers.get(topic) ?? [];
        const idx = h.indexOf(handler as any);
        if (idx >= 0) h.splice(idx, 1);
      },
    };
  }

  async healthcheck(): Promise<QueueHealth> {
    try {
      let totalMessages = 0;
      const topicStats: Record<string, number> = {};

      for (const [topic, queue] of this.queues) {
        const active = queue.filter(m => m.status !== 'completed').length;
        topicStats[topic] = active;
        totalMessages += active;
      }

      return {
        healthy: true,
        mode: 'native',
        provider: this.providerId,
        details: {
          topics: this.queues.size,
          totalMessages,
          topicStats,
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
    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
    // Final persist
    this.persistAll();
    this.queues.clear();
    this.subscribers.clear();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private getOrCreateQueue(topic: string): InternalMessage[] {
    let queue = this.queues.get(topic);
    if (!queue) {
      queue = [];
      this.queues.set(topic, queue);
    }
    return queue;
  }

  private persistAll(): void {
    for (const [topic, queue] of this.queues) {
      const filePath = path.join(this.config.dataDir, `${topic}.json`);
      try {
        fs.writeFileSync(filePath, JSON.stringify(queue, null, 2));
      } catch {
        // Best-effort persistence
      }
    }
  }

  private notifySubscribers(topic: string): void {
    // Subscribers are poll-based, no immediate notification needed
    // This hook exists for future event-driven enhancement
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}