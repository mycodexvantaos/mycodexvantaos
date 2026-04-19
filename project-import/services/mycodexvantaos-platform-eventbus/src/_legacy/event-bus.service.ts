import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — event-bus / EventBusService
 * Core event bus publish/subscribe
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface Subscription { id: string; topic: string; createdAt: number; }

export class EventBusService {
  private subscriptions = new Map<string, Map<string, { id: string; handler: (event: any) => Promise<void> }>>();
  private subCounter = 0;
  private get providers() { return getProviders(); }

  async publish(topic: string, payload: unknown, metadata?: Record<string, string>): Promise<void> {
    const event = { id: `evt-${Date.now()}-${randomBytes(4).toString('hex').slice(0, 8)}`, topic, payload, metadata, publishedAt: Date.now() };
    await this.providers.queue.enqueue(topic, event, { metadata });
    await this.providers.stateStore.increment(`eventbus:count:${topic}`);
    const topicSubs = this.subscriptions.get(topic);
    if (topicSubs) {
      const handlers = Array.from(topicSubs.values());
      await Promise.allSettled(handlers.map(sub => sub.handler(event)));
    }
    this.providers.observability.debug('Event published', { topic, eventId: event.id });
  }

  async subscribe(topic: string, handler: (event: any) => Promise<void>): Promise<Subscription> {
    const subId = `sub-${++this.subCounter}-${Date.now()}`;
    if (!this.subscriptions.has(topic)) this.subscriptions.set(topic, new Map());
    this.subscriptions.get(topic)!.set(subId, { id: subId, handler });
    if (this.providers.queue.subscribe) {
      await this.providers.queue.subscribe(topic, async (msg) => { await handler(msg.payload); });
    }
    this.providers.observability.debug('Subscription created', { topic, subId });
    return { id: subId, topic, createdAt: Date.now() };
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    for (const [topic, subs] of this.subscriptions) {
      if (subs.has(subscriptionId)) {
        subs.delete(subscriptionId);
        if (subs.size === 0) this.subscriptions.delete(topic);
        return;
      }
    }
    throw new Error(`Subscription not found: ${subscriptionId}`);
  }

  async listTopics(): Promise<string[]> {
    const inProcess = Array.from(this.subscriptions.keys());
    const queueTopics = this.providers.queue.listTopics ? await this.providers.queue.listTopics() : [];
    return [...new Set([...inProcess, ...queueTopics])];
  }
}
