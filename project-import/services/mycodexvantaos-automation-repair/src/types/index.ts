/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface Workflow { id: string; name: string; steps: WorkflowStep[]; triggers: string[]; }

export interface WorkflowStep { name: string; action: string; config: Record<string, unknown>; retries: number; timeout: number; }

export interface WorkflowExecution { id: string; workflowId: string; status: "pending" | "running" | "completed" | "failed"; currentStep: number; startedAt: Date; }

export interface StepResult { stepName: string; status: "success" | "failure" | "skipped"; output: unknown; duration: number; }

export interface StepStatus { stepName: string; state: string; attempts: number; lastError?: string; }

export interface StateMachine { id: string; name: string; states: string[]; transitions: TransitionDef[]; initialState: string; }

export interface TransitionDef { from: string; to: string; event: string; guard?: string; }

export interface StateTransition { from: string; to: string; event: string; timestamp: Date; }
