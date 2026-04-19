# Infra GitOps — Architecture Document

## Purpose

`infra-gitops` implements GitOps principles for CodexVanta OS infrastructure management. Git is the single source of truth for desired state, and the system continuously reconciles actual infrastructure to match declared state.

## Reconciliation Loop

```
┌─────────────────────────────────────────┐
│          Reconciliation Loop             │
│                                          │
│  ┌──────┐   ┌──────┐   ┌──────┐        │
│  │ Fetch│──▶│ Diff │──▶│ Apply│──▶ Loop │
│  │ Git  │   │ State│   │ Delta│         │
│  └──────┘   └──────┘   └──────┘        │
│                                          │
│  Interval: configurable (default 60s)   │
│  Trigger: Git webhook or manual          │
└─────────────────────────────────────────┘
```

## State Comparison Model

```
Git Declared State          Actual State
(YAML/JSON in repo)    (infra-base inventory)
        │                       │
        └──────────┬────────────┘
                   │
              ┌────▼────┐
              │  Diff    │
              │  Engine  │
              └────┬─────┘
                   │
         ┌─────────┼─────────┐
         ▼         ▼         ▼
    No Change   Update    Create/Delete
```

## Promotion Pipeline

```
feature-branch ──▶ dev ──▶ staging ──▶ production
                    │        │           │
                  auto     approval    approval
                  deploy   gate        gate +
                           (1 review)  (2 reviews)
```

## Rollback Strategy

1. **Git Revert** — Revert to previous commit, reconciler auto-applies
2. **State Snapshot** — Restore from infra-base state snapshot
3. **Emergency Rollback** — Force-apply known-good state, skip approval gates

## Drift Categories

| Category | Detection | Response |
|---|---|---|
| Configuration | Hash comparison | Auto-correct |
| Resource Count | Inventory diff | Alert + auto-correct |
| Version | Semantic comparison | Alert + gate |
| State | Health check | Escalate |

## Design Principles

1. **Git as Single Source of Truth** — All changes flow through Git
2. **Continuous Reconciliation** — System self-heals without manual intervention
3. **Auditable via Git History** — Every change has a commit author and message
4. **Progressive Promotion** — Changes validated at each environment stage
5. **Safe Rollback** — Any previous state recoverable via Git
