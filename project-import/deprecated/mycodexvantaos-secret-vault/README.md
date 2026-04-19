<div align="center">

# CodexVanta OS — Secret Vault

**Secure Secret Management, Encryption & Credential Rotation**

[![CI](https://img.shields.io/github/actions/workflow/status/codexvanta/codexvanta-os-secret-vault/ci.yml?branch=main&label=CI)](../../actions)
[![Provider Architecture](https://img.shields.io/badge/architecture-Native--first-blue)](#architecture)
[![Tier](https://img.shields.io/badge/tier-1-brightgreen)](#dependency-tier)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## Overview

`secret-vault` provides secure secret management, encryption, and credential rotation for the CodexVanta OS platform. It implements the SecretsProvider interface, giving all services a unified API for storing, retrieving, and rotating secrets. In Native mode, secrets are encrypted at rest using AES-256-GCM with a local master key. In Connected mode, it delegates to external secret managers (HashiCorp Vault, AWS Secrets Manager, Azure Key Vault) via the SecretsProvider interface.

## Key Capabilities

- **Secret CRUD** — Create, read, update, delete secrets with versioning
- **Encryption at Rest** — AES-256-GCM encryption for all stored secrets
- **Automatic Rotation** — Configurable rotation schedules per secret
- **Access Control** — Service-level access policies for secret retrieval
- **Audit Logging** — Every secret access logged with requester identity
- **Secret Versioning** — Version history with rollback capability
- **Dynamic Secrets** — Generate short-lived credentials on demand

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   secret-vault                        │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Secret       │──▶│ Encryption         │           │
│  │ Manager      │   │ Engine (AES-256)   │           │
│  └──────────────┘   └────────────────────┘           │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Rotation     │──▶│ Access             │           │
│  │ Scheduler    │   │ Controller         │           │
│  └──────────────┘   └────────────────────┘           │
│                                                       │
│  ┌──────────────┐   ┌────────────────────┐           │
│  │ Version      │──▶│ Audit              │           │
│  │ Manager      │   │ Logger             │           │
│  └──────────────┘   └────────────────────┘           │
└──────────────────────────────────────────────────────┘
```

## Provider Dependencies

| Provider | Usage |
|---|---|
| DatabaseProvider | Encrypted secret storage and version history |
| StateStoreProvider | Rotation state and lease tracking |
| ObservabilityProvider | Access metrics, rotation status, security events |
| AuthProvider | Service identity verification for access control |

## Operational Modes

| Mode | Behavior |
|---|---|
| **Native** | Local encrypted file/SQLite storage, AES-256-GCM, local master key |
| **Connected** | HashiCorp Vault, AWS Secrets Manager, Azure Key Vault |
| **Hybrid** | External vault for production secrets, local for development |

## Directory Structure

```
codexvanta-os-secret-vault/
├── src/
│   ├── index.ts
│   └── services/
│       ├── SecretVaultService.ts
│       ├── EncryptionService.ts
│       ├── RotationService.ts
│       └── AccessControlService.ts
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
  └─▶ Tier 1: secret-vault ◀── You are here
```

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Related Packages

- [`core-kernel`](../codexvanta-os-core-kernel) — SecretsProvider interface
- [`auth-service`](../codexvanta-os-auth-service) — Service identity for access control
- [`config-manager`](../codexvanta-os-config-manager) — Configuration with secret references

---

<div align="center">
<sub>Part of the <a href="https://github.com/codexvanta">CodexVanta OS</a> platform — Native-first / Provider-agnostic Architecture</sub>
</div>
