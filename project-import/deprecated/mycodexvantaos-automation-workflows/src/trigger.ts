import type { Trigger } from "./types";

let counter = 0;

export class TriggerService {
  private triggers = new Map<string, Trigger>();

  register(type: Trigger["type"], config: Record<string, unknown>, pipelineId: string): Trigger {
    const id = `trig-${++counter}`;
    const trigger: Trigger = { id, type, config, pipelineId, enabled: true };
    this.triggers.set(id, trigger);
    return trigger;
  }

  unregister(triggerId: string): boolean {
    return this.triggers.delete(triggerId);
  }

  getTrigger(triggerId: string): Trigger | null {
    return this.triggers.get(triggerId) ?? null;
  }

  listTriggers(): Trigger[] {
    return Array.from(this.triggers.values());
  }

  listByPipeline(pipelineId: string): Trigger[] {
    return this.listTriggers().filter((t) => t.pipelineId === pipelineId);
  }

  listByType(type: Trigger["type"]): Trigger[] {
    return this.listTriggers().filter((t) => t.type === type);
  }

  enable(triggerId: string): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;
    trigger.enabled = true;
    return true;
  }

  disable(triggerId: string): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;
    trigger.enabled = false;
    return true;
  }

  evaluate(event: { type: string; payload: Record<string, unknown> }): Trigger[] {
    return this.listTriggers().filter(
      (t) => t.enabled && t.type === event.type,
    );
  }
}