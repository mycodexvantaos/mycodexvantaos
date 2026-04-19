# CodexVanta OS — Automation Core

**codexvanta-os-automation-core** is the workflow engine and automation orchestration service of CodexVanta OS. It provides workflow definition, step execution, state machine management, and process automation through a provider-agnostic interface.

---

## Purpose

The Automation Core is the heart of process automation in CodexVanta OS. It enables defining multi-step workflows, executing them with full observability, managing state transitions through finite state machines, and running individual steps with retry and error handling — all without external workflow engines or orchestration platforms.

In **Native mode**, workflow definitions are stored in SQLite, step execution uses in-process async dispatch, and state machines track transitions in memory-backed state stores. In **Connected mode**, it leverages distributed queues, external databases, and cloud-based orchestration.

---

## Core Capabilities

### Workflow Engine Service
- Workflow definition with multi-step DAG support
- Step types: action, condition, parallel, wait
- Workflow execution with per-step status tracking
- Execution listing, cancellation, and history
- Queue-backed asynchronous step dispatch
- Database-persisted workflow definitions and run logs

### Step Runner Service
- Individual step execution with typed input/output
- Step result collection and persistence
- Retry logic with configurable attempts and backoff
- Step listing per workflow execution
- Observability-integrated execution tracing

### State Machine Service
- Finite state machine definition (states + transitions)
- Instance creation from machine definitions
- Event-driven state transitions with guard conditions
- Transition history tracking
- Database-persisted machine definitions and instance states

---

## Architecture

```
┌───────────────────────────────────────────────┐
│            Automation Core                     │
│  ┌───────────────────┐  ┌──────────────────┐  │
│  │WorkflowEngineSvc  │  │StateMachineSvc   │  │
│  └────────┬──────────┘  └────────┬─────────┘  │
│  ┌────────┴──────────┐                         │
│  │ StepRunnerService │                         │
│  └────────┬──────────┘                         │
│           │                                    │
│  ┌────────┴────────────────────────────────┐   │
│  │          Provider Layer                 │   │
│  │  database · queue · stateStore          │   │
│  │  observability                          │   │
│  └─────────────────────────────────────────┘   │
└───────────────────────────────────────────────┘
```

---

## Provider Dependencies

| Provider | Usage |
|----------|-------|
| database | Persist workflow definitions, executions, state machines |
| queue | Asynchronous step dispatch and event handling |
| stateStore | Workflow execution state, state machine instances |
| observability | Trace workflow runs, log step results, metric collection |

---

## Services

| Service | Methods | Description |
|---------|---------|-------------|
| WorkflowEngineService | define, execute, getExecution, listExecutions, cancel | Workflow lifecycle |
| StepRunnerService | runStep, getStepResult, retry, listSteps | Individual step execution |
| StateMachineService | define, createInstance, transition, getState, getHistory | FSM management |

---

## Workflow Step Types

| Type | Description |
|------|-------------|
| action | Execute a function or service call |
| condition | Branch based on expression evaluation |
| parallel | Execute multiple steps concurrently |
| wait | Pause execution for a duration or external signal |

---

## Operational Modes

### Native Mode
- SQLite-persisted workflow definitions
- In-process async step execution
- Memory-backed state machine instances
- Console-based execution tracing

### Connected Mode
- PostgreSQL workflow storage
- Redis/RabbitMQ-backed step queues
- Distributed state machine instances
- External observability integration

---

## Directory Structure

```
codexvanta-os-automation-core/
├── REPO_MANIFEST.yaml
├── README.md
├── ARCHITECTURE.md
├── LICENSE
├── .gitignore
├── package.json
├── tsconfig.json
├── Dockerfile
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── src/
│   ├── index.ts
│   ├── providers.ts
│   ├── types/
│   │   └── index.ts
│   └── services/
│       ├── index.ts
│       ├── workflow-engine.service.ts
│       ├── step-runner.service.ts
│       └── state-machine.service.ts
└── tests/
    └── index.test.ts
```

---

## Tier

**Tier 3** — Depends on core-kernel, event-bus, scheduler

---

## Philosophy

> Workflow automation is a native platform capability.
> External orchestration engines are optional performance enhancers, not prerequisites.

---

## License

MIT — see LICENSE
