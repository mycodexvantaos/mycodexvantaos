<div align="center">

# CodexVanta OS — Network Mesh

**Service Discovery, Routing & Inter-Service Communication**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-network-mesh/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-2-yellow)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`network-mesh` provides service discovery, routing, and inter-service communication for the CodexVanta OS platform. It maintains a service registry, manages health-based routing, and provides both synchronous (request/response) and asynchronous (event-based) communication patterns. In Native mode, it uses in-process function calls and local networking. In Connected mode, it integrates with service mesh technologies (Istio, Linkerd) and external service registries.

## Key Capabilities

- **Service Registry** — Dynamic registration and discovery of platform services
- **Health-Based Routing** — Routes traffic only to healthy service instances
- **Load Balancing** — Round-robin, least-connections, and weighted routing
- **Circuit Breaker** — Automatic failure detection and circuit breaking
- **Retry & Timeout** — Configurable retry policies with exponential backoff
- **Rate Limiting** — Per-service and per-consumer rate limits
- **mTLS** — Mutual TLS for inter-service authentication (Connected mode)

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   network-mesh                        │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Service      │──▶│ Health-Based       │           │
│  │ Registry     │   │ Router             │           │
│  └──────────────┘   └────────────────────┘           │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Load         │──▶│ Circuit            │           │
│  │ Balancer     │   │ Breaker            │           │
│  └──────────────┘   └────────────────────┘           │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Rate         │   │ Retry /            │           │
│  │ Limiter      │   │ Timeout Manager    │           │
│  └──────────────┘   └────────────────────┘           │
│                                                       │
│  Service A ◀──mesh──▶ Service B ◀──mesh──▶ Service C │
└──────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| StateStoreProvider | Service registry state and routing tables |
| ObservabilityProvider | Request metrics, latency, error rates |
| AuthProvider | Service-to-service authentication |
| DatabaseProvider | Routing configuration and rate limit state |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | In-process routing, local function call transport |
| **Connected** | Network-based routing, sidecar proxy, mTLS |
| **Hybrid** | Local services via in-process, remote via network |

## Directory Structure

```
codexvanta-os-network-mesh/
├── src/
│   ├── index.ts
│   └── services/
│       ├── NetworkMeshService.ts
│       ├── ServiceRegistryService.ts
│       ├── RouterService.ts
│       └── CircuitBreakerService.ts
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
  └─▶ Tier 1: infra-base, auth-service, ...
       └─▶ Tier 2: network-mesh ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`infra-base`](../codexvanta-os-infra-base) — Infrastructure layer for network resources
- [`auth-service`](../codexvanta-os-auth-service) — Service identity and authentication
- [`observability-stack`](../codexvanta-os-observability-stack) — Distributed tracing

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
