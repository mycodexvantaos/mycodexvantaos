/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface CIPipeline { id: string; name: string; stages: PipelineStage[]; triggers: string[]; repo: string; }

export interface PipelineStage { name: string; steps: string[]; parallel: boolean; }

export interface PipelineRun { id: string; pipelineId: string; status: "pending" | "running" | "success" | "failure" | "cancelled"; startedAt: Date; completedAt?: Date; }

export interface Trigger { id: string; type: "webhook" | "cron" | "event" | "manual"; config: Record<string, unknown>; pipelineId: string; enabled: boolean; }
