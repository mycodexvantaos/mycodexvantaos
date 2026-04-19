/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface DataSource { id: string; name: string; type: string; config: Record<string, unknown>; status: string; }

export interface IngestionResult { sourceId: string; recordsIngested: number; duration: number; errors: string[]; }

export interface Pipeline { id: string; name: string; steps: PipelineStep[]; createdAt: Date; }

export interface PipelineStep { name: string; type: "filter" | "map" | "aggregate" | "enrich"; config: Record<string, unknown>; }

export interface TransformResult { pipelineId: string; recordsIn: number; recordsOut: number; duration: number; }

export interface PipelineResult { pipelineId: string; status: string; recordsProcessed: number; errors: string[]; }

export interface ExportTarget { id: string; name: string; type: string; config: Record<string, unknown>; }

export interface ExportResult { targetId: string; recordsExported: number; duration: number; }
