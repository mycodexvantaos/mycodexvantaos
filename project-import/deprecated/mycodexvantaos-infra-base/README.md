<div align="center">

# CodexVanta OS — Infra Base

**Infrastructure Foundation & Resource Provisioning Layer**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-infra-base/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-1-brightgreen)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`infra-base` provides the infrastructure foundation layer for CodexVanta OS. It manages resource provisioning, environment configuration, health monitoring, and infrastructure lifecycle across all deployment targets. In Native mode, it manages local resources (filesystem, processes, network ports). In Connected mode, it interfaces with cloud infrastructure providers (AWS, GCP, Azure) and container orchestrators (Kubernetes, Docker Compose) via the DeployProvider interface.

## Key Capabilities

- **Resource Provisioning** — Declarative resource definitions with automatic provisioning
- **Environment Management** — Dev, staging, production environment configurations
- **Health Monitoring** — Infrastructure-level health checks and alerting
- **Capacity Planning** — Resource usage tracking and capacity forecasting
- **Network Configuration** — Port allocation, DNS management, service discovery
- **Infrastructure as Code** — Version-controlled infrastructure definitions
- **Teardown & Cleanup** — Safe deprovisioning with dependency-aware ordering

## Architecture

```
┌──────────────────────────────────────────────────┐
│                   infra-base                      │
│                                                   │
│  ┌──────────────┐   ┌────────────────────┐       │
│  │ Resource     │──▶│ Provisioner        │       │
│  │ Definitions  │   │ (Native / Cloud)   │       │
│  └──────────────┘   └────────────────────┘       │
│                                                   │
│  ┌──────────────┐   ┌────────────────────┐       │
│  │ Environment  │──▶│ Config             │       │
│  │ Manager      │   │ Renderer           │       │
│  └──────────────┘   └────────────────────┘       │
│                                                   │
│  ┌──────────────┐   ┌────────────────────┐       │
│  │ Health       │──▶│ Alert              │       │
│  │ Monitor      │   │ Router             │       │
│  └──────────────┘   └────────────────────┘       │
│                                                   │
│  ┌──────────────┐                                │
│  │ Capacity     │                                │
│  │ Planner      │                                │
│  └──────────────┘                                │
└──────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| DeployProvider | Resource provisioning and lifecycle management |
| StorageProvider | Infrastructure state and configuration files |
| DatabaseProvider | Resource inventory and health history |
| ObservabilityProvider | Infrastructure metrics and alerting |
| SecretsProvider | Infrastructure credentials and API keys |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | Local filesystem resources, process management, port allocation |
| **Connected** | Cloud provider APIs, Kubernetes, Terraform state |
| **Hybrid** | Local dev environment with cloud staging/production |

## Directory Structure

```
codexvanta-os-infra-base/
├── src/
│   ├── index.ts
│   └── services/
│       ├── InfraBaseService.ts
│       ├── ProvisionerService.ts
│       ├── EnvironmentService.ts
│       └── HealthMonitorService.ts
├── tests/
│   └── index.test.ts
├── REPO_MANIFEST.yaml
├── package.json
├── tsconfig.json
└── README.md
```

## Dependency Tier

**Tier 1** — Depends only on `core-kernel` (Tier 0).

```
Tier 0: core-kernel
  └─▶ Tier 1: infra-base ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`infra-gitops`](../codexvanta-os-infra-gitops) — GitOps-driven infrastructure deployment
- [`network-mesh`](../codexvanta-os-network-mesh) — Service mesh and networking
- [`core-kernel`](../codexvanta-os-core-kernel) — DeployProvider interface

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
