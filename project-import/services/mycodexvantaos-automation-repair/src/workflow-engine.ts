import type { Workflow, WorkflowStep, WorkflowExecution, StepResult } from "./types";

let counter = 0;

export class WorkflowEngineService {
  private workflows = new Map<string, Workflow>();
  private executions = new Map<string, WorkflowExecution>();

  register(name: string, steps: WorkflowStep[], triggers: string[] = []): Workflow {
    const id = `wf-${++counter}`;
    const workflow: Workflow = { id, name, steps, triggers };
    this.workflows.set(id, workflow);
    return workflow;
  }

  unregister(workflowId: string): boolean {
    return this.workflows.delete(workflowId);
  }

  getWorkflow(workflowId: string): Workflow | null {
    return this.workflows.get(workflowId) ?? null;
  }

  listWorkflows(): Workflow[] {
    return Array.from(this.workflows.values());
  }

  execute(workflowId: string): WorkflowExecution {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    const execId = `exec-${++counter}`;
    const execution: WorkflowExecution = {
      id: execId,
      workflowId,
      status: "pending",
      currentStep: 0,
      startedAt: new Date(),
    };
    this.executions.set(execId, execution);
    return execution;
  }

  runExecution(executionId: string): StepResult[] {
    const execution = this.executions.get(executionId);
    if (!execution) throw new Error(`Execution ${executionId} not found`);
    const workflow = this.workflows.get(execution.workflowId);
    if (!workflow) throw new Error(`Workflow ${execution.workflowId} not found`);

    execution.status = "running";
    const results: StepResult[] = [];

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      execution.currentStep = i;
      const startTime = Date.now();
      results.push({
        stepName: step.name,
        status: "success",
        output: { action: step.action },
        duration: Date.now() - startTime,
      });
    }

    execution.status = "completed";
    return results;
  }

  getExecution(executionId: string): WorkflowExecution | null {
    return this.executions.get(executionId) ?? null;
  }

  listExecutions(workflowId?: string): WorkflowExecution[] {
    const all = Array.from(this.executions.values());
    if (workflowId) return all.filter((e) => e.workflowId === workflowId);
    return all;
  }
}