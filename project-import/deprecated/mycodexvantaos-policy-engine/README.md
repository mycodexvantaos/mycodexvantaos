<div align="center">

# CodexVanta OS — Policy Engine

**Declarative Policy Definition, Evaluation & Enforcement**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-policy-engine/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-2-yellow)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`policy-engine` provides declarative policy definition, evaluation, and enforcement for the CodexVanta OS platform. Policies define organizational standards for code quality, security, compliance, infrastructure, and operational practices. The engine evaluates repository state against these policies and produces structured results consumed by `decision-engine` and `governance-autonomy`. All evaluation runs natively with a built-in rule engine — no external policy services required.

## Key Capabilities

- **Declarative Policies** — YAML-based policy definitions with version control
- **Policy Categories** — Security, compliance, code quality, infrastructure, operational
- **Evaluation Engine** — Fast, deterministic policy evaluation against repository state
- **Violation Reporting** — Structured violation reports with severity and remediation hints
- **Policy Sets** — Grouped policies applied to repositories by tags or patterns
- **Inheritance** — Policy sets can inherit from and override parent sets
- **Dry Run** — Evaluate policies without enforcement for impact assessment

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   policy-engine                       │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Policy       │──▶│ Policy             │           │
│  │ Definitions  │   │ Compiler           │           │
│  │ (YAML)       │   └────────┬───────────┘           │
│  └──────────────┘            │                        │
│                       ┌──────▼───────┐                │
│  ┌──────────────┐     │ Evaluation   │                │
│  │ Repository   │────▶│ Engine       │                │
│  │ State        │     └──────┬───────┘                │
│  └──────────────┘            │                        │
│                       ┌──────▼───────┐                │
│                       │ Violation    │                │
│                       │ Reporter     │                │
│                       └──────────────┘                │
└──────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| DatabaseProvider | Policy definitions, evaluation history, violation records |
| ValidationProvider | Policy syntax and schema validation |
| StateStoreProvider | Cached evaluation results and policy compilation cache |
| ObservabilityProvider | Evaluation metrics, violation trends |
| RepoProvider | Repository state access for evaluation |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | Built-in rule engine, SQLite policy store, local evaluation |
| **Connected** | External policy store, PostgreSQL history, distributed evaluation |
| **Hybrid** | Native evaluation engine with external policy distribution |

## Directory Structure

```
codexvanta-os-policy-engine/
├── src/
│   ├── index.ts
│   └── services/
│       ├── PolicyEngineService.ts
│       ├── PolicyCompilerService.ts
│       ├── EvaluationService.ts
│       └── ViolationService.ts
├── tests/
│   └── index.test.ts
├── REPO_MANIFEST.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## Dependency Tier

**Tier 2** — Depends on `core-kernel` (Tier 0) and Tier 1 packages.

```
Tier 0: core-kernel
  └─▶ Tier 1: config-manager, ...
       └─▶ Tier 2: policy-engine ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`decision-engine`](../codexvanta-os-decision-engine) — Consumes policy evaluation results
- [`governance-autonomy`](../codexvanta-os-governance-autonomy) — Enforces policy decisions
- [`core-code-deconstructor`](../codexvanta-os-core-code-deconstructor) — Provides code analysis input

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
