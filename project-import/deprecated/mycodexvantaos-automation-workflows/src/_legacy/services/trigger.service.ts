import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — workflows / TriggerService
 * Workflow trigger management (webhook, schedule, event)
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type TriggerType = 'webhook' | 'schedule' | 'event' | 'manual' | 'push' | 'pr';
export interface TriggerDef { id: string; name: string; type: TriggerType; config: Record<string, unknown>; workflowId: string; enabled: boolean; createdAt: number; lastTriggered?: number; triggerCount: number; }

export class TriggerService {
  private get providers() { return getProviders(); }

  async create(trigger: Omit<TriggerDef, 'id' | 'createdAt' | 'triggerCount'>): Promise<TriggerDef> {
    const id = `trigger-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const entry: TriggerDef = { ...trigger, id, createdAt: Date.now(), triggerCount: 0 };
    await this.providers.stateStore.set(`workflows:trigger:${id}`, entry);
    this.providers.observability.info('Trigger created', { id, type: trigger.type, workflow: trigger.workflowId });
    return entry;
  }

  async fire(triggerId: string, payload?: Record<string, unknown>): Promise<void> {
    const trigger = (await this.providers.stateStore.get<TriggerDef>(`workflows:trigger:${triggerId}`))?.value;
    if (!trigger) throw new Error(`Trigger not found: ${triggerId}`);
    if (!trigger.enabled) throw new Error(`Trigger disabled: ${triggerId}`);
    trigger.lastTriggered = Date.now();
    trigger.triggerCount++;
    await this.providers.stateStore.set(`workflows:trigger:${triggerId}`, trigger);
    await this.providers.queue.enqueue('workflows:trigger:fired', { triggerId, workflowId: trigger.workflowId, payload, timestamp: Date.now() });
    this.providers.observability.info('Trigger fired', { triggerId, type: trigger.type, workflow: trigger.workflowId });
  }

  async get(triggerId: string): Promise<TriggerDef | null> { return (await this.providers.stateStore.get<TriggerDef>(`workflows:trigger:${triggerId}`))?.value ?? null; }
  async delete(triggerId: string): Promise<boolean> { return this.providers.stateStore.delete(`workflows:trigger:${triggerId}`); }
  async enable(triggerId: string): Promise<TriggerDef> { return this.toggle(triggerId, true); }
  async disable(triggerId: string): Promise<TriggerDef> { return this.toggle(triggerId, false); }

  async list(type?: TriggerType): Promise<TriggerDef[]> {
    const result = await this.providers.stateStore.scan<TriggerDef>({ pattern: 'workflows:trigger:*', count: 100 });
    let triggers = result.entries.map(e => e.value).filter(t => t.type);
    if (type) triggers = triggers.filter(t => t.type === type);
    return triggers;
  }

  private async toggle(id: string, enabled: boolean): Promise<TriggerDef> {
    const trigger = (await this.providers.stateStore.get<TriggerDef>(`workflows:trigger:${id}`))?.value;
    if (!trigger) throw new Error(`Trigger not found: ${id}`);
    trigger.enabled = enabled;
    await this.providers.stateStore.set(`workflows:trigger:${id}`, trigger);
    return trigger;
  }
}
