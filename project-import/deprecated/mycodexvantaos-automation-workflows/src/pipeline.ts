import type { CIPipeline, PipelineStage, PipelineRun } from "./types";

let counter = 0;

export class PipelineService {
  private pipelines = new Map<string, CIPipeline>();
  private runs = new Map<string, PipelineRun>();

  create(name: string, stages: PipelineStage[], triggers: string[], repo: string): CIPipeline {
    const id = `pipe-${++counter}`;
    const pipeline: CIPipeline = { id, name, stages, triggers, repo };
    this.pipelines.set(id, pipeline);
    return pipeline;
  }

  remove(pipelineId: string): boolean {
    return this.pipelines.delete(pipelineId);
  }

  getPipeline(pipelineId: string): CIPipeline | null {
    return this.pipelines.get(pipelineId) ?? null;
  }

  listPipelines(): CIPipeline[] {
    return Array.from(this.pipelines.values());
  }

  listByRepo(repo: string): CIPipeline[] {
    return this.listPipelines().filter((p) => p.repo === repo);
  }

  trigger(pipelineId: string): PipelineRun {
    const pipeline = this.pipelines.get(pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);
    const runId = `run-${++counter}`;
    const run: PipelineRun = {
      id: runId,
      pipelineId,
      status: "pending",
      startedAt: new Date(),
    };
    this.runs.set(runId, run);
    return run;
  }

  runPipeline(runId: string): PipelineRun {
    const run = this.runs.get(runId);
    if (!run) throw new Error(`Run ${runId} not found`);
    const pipeline = this.pipelines.get(run.pipelineId);
    if (!pipeline) throw new Error(`Pipeline ${run.pipelineId} not found`);

    run.status = "running";
    // Simulate execution of all stages
    for (const _stage of pipeline.stages) {
      // Each stage processed in-memory
    }
    run.status = "success";
    run.completedAt = new Date();
    return run;
  }

  cancelRun(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.status === "success" || run.status === "failure" || run.status === "cancelled") return false;
    run.status = "cancelled";
    run.completedAt = new Date();
    return true;
  }

  getRun(runId: string): PipelineRun | null {
    return this.runs.get(runId) ?? null;
  }

  listRuns(pipelineId?: string): PipelineRun[] {
    const all = Array.from(this.runs.values());
    if (pipelineId) return all.filter((r) => r.pipelineId === pipelineId);
    return all;
  }
}