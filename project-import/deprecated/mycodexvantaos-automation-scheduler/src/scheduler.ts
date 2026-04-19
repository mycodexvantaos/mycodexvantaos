import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — scheduler / SchedulerService
 * In-memory task scheduling and execution
 */

import type { ScheduledTask } from "./types";

export type TaskStatus = ScheduledTask["status"];

interface InternalTask extends ScheduledTask {
  executeAt: number;
  attempts: number;
  maxAttempts: number;
  result?: unknown;
  error?: string;
}

export class SchedulerService {
  private tasks = new Map<string, InternalTask>();

  async schedule(
    name: string,
    payload: unknown,
    executeAt: number,
    options?: { maxAttempts?: number },
  ): Promise<ScheduledTask> {
    const task: InternalTask = {
      id: `task-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`,
      name,
      payload,
      scheduledAt: new Date(),
      status: "pending",
      createdAt: new Date(),
      executeAt,
      attempts: 0,
      maxAttempts: options?.maxAttempts ?? 3,
    };
    this.tasks.set(task.id, task);
    return this.toPublic(task);
  }

  async cancel(taskId: string): Promise<ScheduledTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    task.status = "cancelled";
    return this.toPublic(task);
  }

  async getTask(taskId: string): Promise<ScheduledTask | null> {
    const task = this.tasks.get(taskId);
    return task ? this.toPublic(task) : null;
  }

  async listTasks(status?: TaskStatus, limit = 50): Promise<ScheduledTask[]> {
    let tasks = Array.from(this.tasks.values());
    if (status) tasks = tasks.filter((t) => t.status === status);
    tasks.sort((a, b) => a.executeAt - b.executeAt);
    return tasks.slice(0, limit).map((t) => this.toPublic(t));
  }

  async processDueTasks(): Promise<number> {
    const now = Date.now();
    let processed = 0;
    for (const task of this.tasks.values()) {
      if (task.status === "pending" && task.executeAt <= now) {
        task.status = "running";
        task.attempts++;
        // Simulate instant completion for in-memory stub
        task.status = "completed";
        processed++;
      }
    }
    return processed;
  }

  private toPublic(task: InternalTask): ScheduledTask {
    return {
      id: task.id,
      name: task.name,
      payload: task.payload,
      scheduledAt: task.scheduledAt,
      status: task.status,
      createdAt: task.createdAt,
    };
  }
}