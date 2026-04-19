<div align="center">

# CodexVanta OS — Infra GitOps

**Git-Driven Infrastructure Deployment & Reconciliation**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-infra-gitops/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-2-yellow)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`infra-gitops` implements the GitOps deployment model for CodexVanta OS infrastructure. It treats Git repositories as the single source of truth for desired infrastructure state and continuously reconciles actual state with declared state. In Native mode, it monitors local file changes and applies infrastructure updates via `infra-base`. In Connected mode, it integrates with Git hosting platforms and deployment pipelines via RepoProvider and DeployProvider.

## Key Capabilities

- **Continuous Reconciliation** — Watches Git state and ensures infrastructure matches declarations
- **Drift Detection & Correction** — Identifies and auto-corrects infrastructure drift
- **Deployment Pipelines** — Git-triggered deployment workflows with approval gates
- **Rollback** — One-command rollback to any previous Git-committed state
- **Multi-Environment Promotion** — Promote changes from dev → staging → production via Git
- **Change Tracking** — Every infrastructure change traceable to a Git commit
- **Preview Environments** — Ephemeral environments for pull request review

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   infra-gitops                        │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Git Watcher  │──▶│ State              │           │
│  │ (webhooks /  │   │ Comparator         │           │
│  │  polling)    │   └────────┬───────────┘           │
│  └──────────────┘            │                        │
│                    ┌─────────┼─────────┐              │
│                    ▼         ▼         ▼              │
│              ┌────────┐ ┌────────┐ ┌────────┐        │
│              │ No     │ │ Update │ │ Create │        │
│              │ Change │ │ Needed │ │ Needed │        │
│              └────────┘ └───┬────┘ └───┬────┘        │
│                             │          │              │
│                    ┌────────▼──────────▼──────┐      │
│                    │ infra-base Provisioner   │      │
│                    └──────────────────────────┘      │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Rollback     │   │ Promotion          │           │
│  │ Controller   │   │ Pipeline           │           │
│  └──────────────┘   └────────────────────┘           │
└──────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| RepoProvider | Git repository access, webhook registration, commit history |
| DeployProvider | Infrastructure provisioning via infra-base |
| StateStoreProvider | Reconciliation state, last-applied revision |
| DatabaseProvider | Deployment history and audit logs |
| ObservabilityProvider | Reconciliation metrics, drift detection alerts |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | File-system watcher on local Git repos, local infra-base provisioning |
| **Connected** | GitHub/GitLab webhooks, cloud infrastructure reconciliation |
| **Hybrid** | Git webhooks with local provisioning (dev environments) |

## Directory Structure

```
codexvanta-os-infra-gitops/
├── src/
│   ├── index.ts
│   └── services/
│       ├── InfraGitOpsService.ts
│       ├── ReconcilerService.ts
│       ├── DriftDetectorService.ts
│       └── PromotionService.ts
├── tests/
│   └── index.test.ts
├── REPO_MANIFEST.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## Dependency Tier

**Tier 2** — Depends on `core-kernel` (Tier 0) and `infra-base` (Tier 1).

```
Tier 0: core-kernel
  └─▶ Tier 1: infra-base
       └─▶ Tier 2: infra-gitops ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`infra-base`](../codexvanta-os-infra-base) — Infrastructure provisioning engine
- [`workflows`](../codexvanta-os-workflows) — Deployment workflow definitions
- [`control-center`](../codexvanta-os-control-center) — Deployment dashboard

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
