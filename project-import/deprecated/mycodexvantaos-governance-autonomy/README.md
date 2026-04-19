<div align="center">

# CodexVanta OS — Governance Autonomy

**Autonomous Governance Framework & Compliance Orchestration**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-governance-autonomy/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-3-orange)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

> ⚠️ **Scaffold Phase Note**
>
> This module is in scaffold phase with placeholder implementations.
> The compliance service uses hardcoded demo rules (resource-ownership, resource-tagging).
> Configurable rule engine is planned but not yet implemented.

`governance-autonomy` is the platform's autonomous governance framework that orchestrates compliance enforcement, approval workflows, and organizational policy adherence across all 25 repositories. It combines policy evaluation results from `policy-engine` with decision outputs from `decision-engine` to enforce governance rules — automatically approving compliant changes, gating risky operations for human review, and escalating violations. The framework maintains a complete audit trail of all governance actions and supports configurable autonomy levels per repository or team.

## Key Capabilities

- **Autonomy Levels** — Configurable per-repo autonomy: Full-Auto, Semi-Auto, Manual-Only
- **Approval Workflows** — Multi-stage approval chains with role-based routing
- **Compliance Tracking** — Real-time compliance posture across all repositories
- **Exemption Management** — Temporary policy exemptions with expiration and audit
- **Governance Dashboard Data** — Aggregated governance metrics for control-center
- **Drift Detection** — Detects when repositories drift from governance baselines
- **Rollback Authority** — Automatic rollback triggers when post-deploy governance checks fail

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                governance-autonomy                        │
│                                                           │
│  ┌───────────────┐   ┌────────────────┐                  │
│  │ Autonomy      │──▶│ Approval       │                  │
│  │ Level Manager │   │ Workflow Engine │                  │
│  └───────────────┘   └───────┬────────┘                  │
│                              │                            │
│  ┌───────────────┐   ┌──────▼─────────┐                  │
│  │ Compliance    │──▶│ Governance     │                  │
│  │ Tracker       │   │ Decision Hub   │                  │
│  └───────────────┘   └───────┬────────┘                  │
│                              │                            │
│  ┌───────────────┐   ┌──────▼─────────┐                  │
│  │ Exemption     │   │ Audit          │                  │
│  │ Manager       │   │ Trail          │                  │
│  └───────────────┘   └────────────────┘                  │
│                                                           │
│  ┌───────────────┐                                       │
│  │ Drift         │                                       │
│  │ Detector      │                                       │
│  └───────────────┘                                       │
└──────────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| DatabaseProvider | Governance state, approval history, compliance records |
| StateStoreProvider | Active approval workflows and pending decisions |
| NotificationProvider | Approval requests, escalation alerts, compliance reports |
| ObservabilityProvider | Governance metrics and compliance posture telemetry |
| AuthProvider | Role-based approval authority verification |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | Local rule evaluation, SQLite governance store, in-memory workflows |
| **Connected** | External approval systems, PostgreSQL governance DB, Slack notifications |
| **Hybrid** | Native evaluation with external notification delivery |

## Directory Structure

```
codexvanta-os-governance-autonomy/
├── src/
│   ├── index.ts
│   └── services/
│       ├── GovernanceAutonomyService.ts
│       ├── ApprovalWorkflowService.ts
│       ├── ComplianceService.ts
│       └── ExemptionService.ts
├── tests/
│   └── index.test.ts
├── REPO_MANIFEST.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## Dependency Tier

**Tier 3** — Depends on `decision-engine`, `policy-engine`, and Tier 1–2 packages.

```
Tier 0: core-kernel
  └─▶ Tier 1 → Tier 2: core-main, ...
       └─▶ Tier 3: governance-autonomy ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`decision-engine`](../codexvanta-os-decision-engine) — Provides decision inputs
- [`policy-engine`](../codexvanta-os-policy-engine) — Policy evaluation results
- [`control-center`](../codexvanta-os-control-center) — Governance dashboard consumer

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
