# Secret Vault — Architecture Document

## Purpose

`secret-vault` implements the SecretsProvider interface for CodexVanta OS. It provides secure storage, retrieval, rotation, and access control for all platform secrets and credentials.

## Encryption Architecture

```
┌──────────────────────────────────────┐
│          Encryption Layers           │
│                                      │
│  ┌────────────────────┐              │
│  │ Master Key         │              │
│  │ (derived from env) │              │
│  └─────────┬──────────┘              │
│            │                         │
│  ┌─────────▼──────────┐             │
│  │ Data Encryption    │             │
│  │ Key (DEK)          │             │
│  │ per-secret         │             │
│  └─────────┬──────────┘             │
│            │                         │
│  ┌─────────▼──────────┐             │
│  │ AES-256-GCM        │             │
│  │ Encrypted Secret   │             │
│  │ + IV + Auth Tag    │             │
│  └────────────────────┘             │
└──────────────────────────────────────┘
```

## Secret Storage Schema

```typescript
interface StoredSecret {
  id: string;
  name: string;
  encryptedValue: Buffer;    // AES-256-GCM ciphertext
  iv: Buffer;                // Initialization vector
  authTag: Buffer;           // GCM authentication tag
  version: number;
  createdAt: Date;
  rotatedAt: Date | null;
  expiresAt: Date | null;
  accessPolicy: AccessPolicy;
  metadata: Record<string, string>;
}
```

## Rotation Flow

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Schedule │──▶│ Generate │──▶│ Encrypt  │──▶│ Store    │
│ Trigger  │   │ New Value│   │ & Version│   │ New Ver  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘
                                                    │
                                              ┌─────▼─────┐
                                              │ Notify    │
                                              │ Consumers │
                                              └─────┬─────┘
                                                    │
                                              ┌─────▼─────┐
                                              │ Grace     │
                                              │ Period    │
                                              └─────┬─────┘
                                                    │
                                              ┌─────▼─────┐
                                              │ Revoke    │
                                              │ Old Ver   │
                                              └───────────┘
```

## Access Control Model

```yaml
access_policy:
  secret: "database-password"
  allowed_services:
    - "core-main"
    - "data-pipeline"
  allowed_operations:
    - "read"
  requires_audit: true
  max_lease_duration: "1h"
```

## Audit Trail

Every secret access produces an audit record:

| Field | Description |
|---|---|
| timestamp | When the access occurred |
| secret_name | Which secret was accessed |
| requester | Service identity |
| operation | read / write / rotate / delete |
| outcome | success / denied / error |
| ip_address | Requester's address |

## Design Principles

1. **Encrypt Everything** — No secret stored in plaintext, ever
2. **Least Privilege** — Services only access secrets they're authorized for
3. **Automatic Rotation** — Reduce secret lifetime to minimize exposure window
4. **Full Audit Trail** — Every access logged and queryable
5. **Zero-Trust** — Verify identity on every access, no persistent sessions
