import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — scheduler / SchedulerService
 * Task scheduling and execution
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface ScheduledTask { id: string; name: string; payload: unknown; scheduledAt: number; executeAt: number; status: TaskStatus; attempts: number; maxAttempts: number; result?: unknown; error?: string; }

export class SchedulerService {
  private get providers() { return getProviders(); }

  async schedule(name: string, payload: unknown, executeAt: number, options?: { maxAttempts?: number }): Promise<ScheduledTask> {
    const task: ScheduledTask = { id: `task-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`, name, payload, scheduledAt: Date.now(), executeAt, status: 'pending', attempts: 0, maxAttempts: options?.maxAttempts ?? 3 };
    const delay = Math.max(0, executeAt - Date.now());
    await this.providers.queue.enqueue('scheduler:tasks', task, { delay, maxAttempts: task.maxAttempts });
    await this.providers.stateStore.set(`scheduler:task:${task.id}`, task);
    this.providers.observability.info('Task scheduled', { taskId: task.id, name, executeAt: new Date(executeAt).toISOString() });
    return task;
  }

  async cancel(taskId: string): Promise<ScheduledTask> {
    const entry = await this.providers.stateStore.get<ScheduledTask>(`scheduler:task:${taskId}`);
    if (!entry) throw new Error(`Task not found: ${taskId}`);
    const task = entry.value;
    task.status = 'cancelled';
    await this.providers.stateStore.set(`scheduler:task:${taskId}`, task);
    return task;
  }

  async getTask(taskId: string): Promise<ScheduledTask | null> {
    const entry = await this.providers.stateStore.get<ScheduledTask>(`scheduler:task:${taskId}`);
    return entry?.value ?? null;
  }

  async listTasks(status?: TaskStatus, limit: number = 50): Promise<ScheduledTask[]> {
    const result = await this.providers.stateStore.scan<ScheduledTask>({ pattern: 'scheduler:task:*', count: limit });
    let tasks = result.entries.map(e => e.value);
    if (status) tasks = tasks.filter(t => t.status === status);
    return tasks.sort((a, b) => a.executeAt - b.executeAt);
  }

  async processDueTasks(): Promise<number> {
    const now = Date.now();
    const pendingTasks = await this.listTasks('pending');
    let processed = 0;
    for (const task of pendingTasks) {
      if (task.executeAt <= now) {
        task.status = 'running'; task.attempts++;
        await this.providers.stateStore.set(`scheduler:task:${task.id}`, task);
        await this.providers.queue.enqueue('scheduler:execute', task);
        processed++;
      }
    }
    return processed;
  }
}
