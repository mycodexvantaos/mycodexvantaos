/**
 * CodexvantaOS — data-pipeline / TransformationService
 * In-memory data transformation with pipeline steps
 */

import type { Pipeline, PipelineStep, TransformResult } from "./types";

export class TransformationService {
  private pipelines = new Map<string, Pipeline>();

  async createPipeline(name: string, steps: PipelineStep[]): Promise<Pipeline> {
    const id = `pipe-${name}-${Date.now()}`;
    const pipeline: Pipeline = { id, name, steps, createdAt: new Date() };
    this.pipelines.set(id, pipeline);
    return pipeline;
  }

  async execute(pipelineId: string, data: unknown[]): Promise<{ result: unknown[]; summary: TransformResult }> {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) throw new Error(`Pipeline not found: ${pipelineId}`);
    const start = Date.now();
    let current = [...data];
    for (const step of pipeline.steps) {
      current = this.applyStep(step, current);
    }
    return {
      result: current,
      summary: {
        pipelineId,
        recordsIn: data.length,
        recordsOut: current.length,
        duration: Date.now() - start,
      },
    };
  }

  async getPipeline(pipelineId: string): Promise<Pipeline | null> {
    return this.pipelines.get(pipelineId) ?? null;
  }

  async listPipelines(): Promise<Pipeline[]> {
    return Array.from(this.pipelines.values());
  }

  async deletePipeline(pipelineId: string): Promise<boolean> {
    return this.pipelines.delete(pipelineId);
  }

  private applyStep(step: PipelineStep, data: unknown[]): unknown[] {
    switch (step.type) {
      case "filter": {
        const field = step.config["field"] as string;
        const value = step.config["value"];
        if (!field) return data;
        return data.filter((r) => (r as Record<string, unknown>)[field] === value);
      }
      case "map": {
        const addField = step.config["addField"] as string;
        const addValue = step.config["addValue"];
        if (!addField) return data;
        return data.map((r) => ({ ...(r as object), [addField]: addValue }));
      }
      default:
        return data;
    }
  }
}