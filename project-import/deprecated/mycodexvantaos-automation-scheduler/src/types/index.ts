/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface ScheduledTask { id: string; name: string; payload: unknown; scheduledAt: Date; status: "pending" | "running" | "completed" | "failed" | "cancelled"; createdAt: Date; }

export interface CronJob { id: string; name: string; expression: string; handler: string; enabled: boolean; lastRun?: Date; nextRun?: Date; }
