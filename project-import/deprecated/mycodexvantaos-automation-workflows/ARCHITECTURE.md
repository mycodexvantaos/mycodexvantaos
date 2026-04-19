# Workflows — Architecture Document

## Purpose

`workflows` provides the top-level orchestration engine for CodexVanta OS. It coordinates multi-step, multi-service operations through declarative workflow definitions, managing the complete execution lifecycle from trigger to completion (or rollback).

## Workflow Definition Model

```yaml
workflow:
  name: "full-repository-scan"
  version: "1.0.0"
  trigger:
    - event: "repository.push"
    - schedule: "0 2 * * *"
  
  steps:
    - id: "clone"
      service: "fleet-sandbox"
      action: "createSandbox"
      params:
        repository: "{{ trigger.repository }}"
    
    - id: "scan"
      service: "core-code-deconstructor"
      action: "analyze"
      depends_on: ["clone"]
      params:
        workspace: "{{ steps.clone.output.workspace }}"
    
    - id: "evaluate"
      service: "policy-engine"
      action: "evaluate"
      depends_on: ["scan"]
      params:
        scanResults: "{{ steps.scan.output }}"
    
    - id: "decide"
      service: "decision-engine"
      action: "evaluate"
      depends_on: ["evaluate"]
      condition: "{{ steps.evaluate.output.violations > 0 }}"
    
    - id: "cleanup"
      service: "fleet-sandbox"
      action: "destroySandbox"
      depends_on: ["scan"]
      always_run: true
  
  on_failure:
    - notify:
        channel: "platform-alerts"
        message: "Workflow failed: {{ workflow.name }}"
```

## Step Execution Patterns

```
Sequential:     A → B → C
Parallel:       A → [B, C] → D  (B and C run simultaneously)
Conditional:    A → if(condition) → B else → C
Fan-out/in:     A → [B1, B2, B3, ..., Bn] → C
Sub-workflow:    A → SubWorkflow(X) → B
```

## State Machine

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Pending  │──▶│ Running  │──▶│ Complete │   │ Failed   │
└──────────┘   └────┬─────┘   └──────────┘   └──────────┘
                    │                              ▲
                    ├── step fails ─────────────────┘
                    │
               ┌────▼─────┐
               │ Paused   │  (manual intervention)
               └────┬─────┘
                    │
               ┌────▼─────┐
               │ Cancelled│
               └──────────┘
```

## Rollback Strategy

When a workflow fails, the rollback controller executes compensation actions in reverse order:

```
Forward:   Step A → Step B → Step C (fails)
Rollback:  Compensate B → Compensate A

Each step can define:
  compensation:
    action: "undoAction"
    params: { ... }
```

## Template Engine

Workflow definitions support expression templates:

| Expression | Description |
|---|---|
| `{{ trigger.* }}` | Trigger event data |
| `{{ steps.ID.output }}` | Previous step output |
| `{{ steps.ID.status }}` | Previous step status |
| `{{ env.* }}` | Environment variables |
| `{{ secrets.* }}` | Resolved secrets |

## Trigger Types

| Type | Description |
|---|---|
| Event | Platform event from event-bus |
| Schedule | Cron expression via scheduler |
| Manual | User-initiated via API or UI |
| Webhook | External HTTP trigger |
| Workflow | Triggered by another workflow's completion |

## Design Principles

1. **Declarative First** — Workflows are data (YAML), not code
2. **Reliable Execution** — State persisted at every step for crash recovery
3. **Composable** — Complex workflows built from simpler sub-workflows
4. **Observable** — Full execution trace with per-step metrics
5. **Safe Failure** — Compensation actions ensure clean rollback on failure
