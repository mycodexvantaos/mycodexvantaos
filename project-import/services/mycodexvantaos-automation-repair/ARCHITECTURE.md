# CodexVanta OS — Automation Core Architecture

## Overview

The Automation Core provides the workflow execution engine, step runner, and state machine framework for CodexVanta OS. It enables complex multi-step process automation with full observability, retry handling, and state management.

---

## Design Principles

1. **DAG-based workflows** — Workflows are defined as directed acyclic graphs of steps. Each step has typed inputs, outputs, and dependencies on previous steps.

2. **Step-level isolation** — Each step runs independently with its own error handling and retry logic. A failed step does not necessarily fail the entire workflow.

3. **State machine formalism** — Business processes that require explicit state tracking use finite state machines with defined transitions, guards, and history.

4. **Queue-backed execution** — Steps are dispatched through the QueueProvider for reliable execution. In native mode, this is an in-process EventEmitter. In connected mode, this is a distributed message queue.

---

## Workflow Execution Flow

```
Define Workflow
     │
     ▼
Store Definition (database)
     │
     ▼
Execute Workflow → Create Execution Record
     │
     ▼
For Each Step (topological order):
     │
     ├─ action → StepRunner.runStep()
     ├─ condition → Evaluate expression → Branch
     ├─ parallel → Dispatch all sub-steps concurrently
     └─ wait → Set timer or wait for signal
     │
     ▼
Update Execution Status (stateStore)
     │
     ▼
Complete / Failed / Cancelled
```

## State Machine Flow

```
Define Machine (states + transitions)
     │
     ▼
Create Instance (initial state)
     │
     ▼
Receive Event → Find Matching Transition
     │
     ├─ Guard check → Pass → Execute transition
     │                         │
     │                   Update state (stateStore)
     │                   Record history (database)
     │
     └─ No match → Reject event
```

---

## Data Model

### Workflow Definition
```
{
  id: string
  name: string
  version: string
  steps: WorkflowStep[]
  createdAt: Date
}
```

### Workflow Step
```
{
  id: string
  name: string
  type: 'action' | 'condition' | 'parallel' | 'wait'
  config: Record<string, any>
  dependsOn: string[]
  retryPolicy: { maxAttempts: number, backoffMs: number }
}
```

### State Machine Definition
```
{
  id: string
  name: string
  initialState: string
  states: string[]
  transitions: Transition[]
}
```

### Transition
```
{
  from: string
  to: string
  event: string
  guard?: string (expression)
}
```

---

## Provider Usage Map

| Service | database | queue | stateStore | observability |
|---------|----------|-------|------------|---------------|
| WorkflowEngineService | definitions, executions | step dispatch | execution state | trace runs |
| StepRunnerService | — | — | step results | trace steps |
| StateMachineService | definitions, history | — | instance state | log transitions |

---

## Error Handling

- Steps have configurable retry policies (max attempts, backoff)
- Failed steps can be retried individually without re-running the workflow
- Workflow-level timeout prevents infinite execution
- State machine transitions are atomic — either complete or not applied
- All errors logged through ObservabilityProvider

---

## Dependencies

- **Tier 3** in the CodexVanta OS dependency hierarchy
- Depends on: core-kernel, event-bus (event dispatch), scheduler (timed execution)
- Consumed by: workflows, decision-engine, governance-autonomy
