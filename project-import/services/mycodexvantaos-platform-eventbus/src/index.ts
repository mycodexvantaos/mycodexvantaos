/**
 * CodexvantaOS — event-bus
 * 事件匯流排 — Event publish/subscribe, routing, filtering
 *
 * Layer: B-Runtime | Tier: 1
 */
import pino from "pino";

const logger = pino({ name: "event-bus" });

// Re-export types
export * from "./types";

export interface EventEnvelope {
  id: string;
  topic: string;
  payload: unknown;
  timestamp: number;
  source: string;
  metadata?: Record<string, string>;
}

export type EventHandler = (event: EventEnvelope) => Promise<void>;

/**
 * EventBusService — in-memory pub/sub event bus
 */
export class EventBusService {
  private subscriptions = new Map<string, Map<string, EventHandler>>();
  private counter = 0;

  async publish(topic: string, payload: unknown, source = "unknown"): Promise<EventEnvelope> {
    const event: EventEnvelope = {
      id: `evt-${Date.now()}-${++this.counter}`,
      topic,
      payload,
      timestamp: Date.now(),
      source,
    };

    const handlers = this.subscriptions.get(topic);
    if (handlers) {
      const promises = Array.from(handlers.values()).map((h) => h(event));
      await Promise.allSettled(promises);
    }

    logger.debug({ topic, eventId: event.id }, "Event published");
    return event;
  }

  subscribe(topic: string, handler: EventHandler): string {
    const subId = `sub-${++this.counter}`;
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Map());
    }
    this.subscriptions.get(topic)!.set(subId, handler);
    logger.debug({ topic, subId }, "Subscription created");
    return subId;
  }

  unsubscribe(topic: string, subId: string): boolean {
    const handlers = this.subscriptions.get(topic);
    if (!handlers) return false;
    return handlers.delete(subId);
  }

  getTopics(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  getSubscriptionCount(topic: string): number {
    return this.subscriptions.get(topic)?.size ?? 0;
  }
}
