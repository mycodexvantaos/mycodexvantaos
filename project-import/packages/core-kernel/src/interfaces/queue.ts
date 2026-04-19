/**
 * QueueProvider Interface
 *
 * Abstraction for task queue and background job operations.
 * Platform MUST provide a native implementation (MemoryQueue / DB-backed Queue).
 * External providers (Redis, RabbitMQ, SQS, Kafka) are optional connectors.
 *
 * @layer Layer B (Runtime) + Layer C (Native Services) + Layer D (Connector)
 */

export interface QueueMessage<T = unknown> {
  id: string;
  topic: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  scheduledAt?: Date;
  metadata?: Record<string, string>;
}

export interface QueueStats {
  topic: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface QueueHealth {
  available: boolean;
  provider: string;
  topics: string[];
  totalPending: number;
}

export interface EnqueueOptions {
  delay?: number;
  maxAttempts?: number;
  priority?: number;
  metadata?: Record<string, string>;
}

export interface QueueProvider {
  /** Unique provider identifier */
  readonly providerId: string;

  /** Provider mode: 'native' | 'external' */
  readonly mode: 'native' | 'external';

  /** Initialize queue backend */
  init(): Promise<void>;

  /** Enqueue a message to a topic */
  enqueue<T = unknown>(topic: string, payload: T, options?: EnqueueOptions): Promise<string>;

  /** Dequeue the next message from a topic */
  dequeue<T = unknown>(topic: string): Promise<QueueMessage<T> | null>;

  /** Acknowledge a message as processed successfully */
  ack(topic: string, messageId: string): Promise<void>;

  /** Mark a message for retry */
  retry(topic: string, messageId: string, delay?: number): Promise<void>;

  /** Move a message to dead-letter queue */
  fail(topic: string, messageId: string, reason?: string): Promise<void>;

  /** Get queue size for a topic */
  size(topic: string): Promise<number>;

  /** Get queue statistics */
  stats(topic: string): Promise<QueueStats>;

  /** Subscribe to a topic with a handler (push model) */
  subscribe?<T = unknown>(
    topic: string,
    handler: (message: QueueMessage<T>) => Promise<void>,
    options?: { concurrency?: number }
  ): Promise<{ unsubscribe: () => Promise<void> }>;

  /** Purge all messages from a topic */
  purge?(topic: string): Promise<number>;

  /** List all known topics */
  listTopics?(): Promise<string[]>;

  /** Health check */
  healthcheck(): Promise<QueueHealth>;

  /** Graceful shutdown */
  close(): Promise<void>;
}