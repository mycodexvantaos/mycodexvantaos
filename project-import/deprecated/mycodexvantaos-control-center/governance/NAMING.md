# CodexvantaOS Repository Naming Standard

## Purpose

This document defines the canonical naming convention for all repositories in the CodexvantaOS fleet.

The goal is to ensure repository names are:

- consistent
- predictable
- machine-parseable
- governance-friendly
- safe for automation, registry validation, and cross-repository orchestration

This naming standard is mandatory for all current and future repositories.

---

## Canonical Prefix

All repositories MUST begin with:

`codexvanta-os-`

Examples:

- `codexvanta-os-workflows`
- `codexvanta-os-control-center`
- `codexvanta-os-core-main`

---

## Naming Models

Repositories MUST use one of the following structures.

### Model A: capability-only

`codexvanta-os-<capability>`

Examples:

- `codexvanta-os-workflows`
- `codexvanta-os-cli`
- `codexvanta-os-scheduler`

### Model B: layer-role

`codexvanta-os-<layer>-<role>`

Examples:

- `codexvanta-os-core-main`
- `codexvanta-os-infra-base`
- `codexvanta-os-app-portal`

### Model C: layer-domain-role

`codexvanta-os-<layer>-<domain>-<role>`

Examples:

- `codexvanta-os-core-code-deconstructor`
- `codexvanta-os-sec-secret-vault`

---

## Character Rules

Repository names MUST:

- use only lowercase letters
- use only digits when necessary
- use hyphens `-` as separators
- never use underscores `_`
- never use spaces
- never use dots `.`
- never use repeated separators like `--`

---

## Forbidden Patterns

The following are forbidden:

- names not starting with `codexvanta-os-`
- camelCase or PascalCase names
- repository names ending with version numbers such as `-v1`, `-v2`
- names containing environment markers such as `-prod`, `-staging`, `-dev`, `-test`

Examples of invalid names:

- `codexvantaOS-core-main`
- `codexvanta-os_core_main`
- `codexvanta-os-core.main`
- `codexvanta-os-prod-api`
- `workflows`

---

## Naming Is Not Metadata

Do not encode these into repository names:

- version
- environment
- owner team
- criticality
- deployment platform
- lifecycle phase
- compliance posture

Keep these in metadata files such as:

- `repo-naming-policy.yaml`
- `repos.yaml`
- `engineering.spec.yaml`
- `repo.card.yaml`

---

## Canonical Current Repositories

- `codexvanta-os-cli`
- `codexvanta-os-scheduler`
- `codexvanta-os-secret-vault`
- `codexvanta-os-network-mesh`
- `codexvanta-os-data-pipeline`
- `codexvanta-os-config-manager`
- `codexvanta-os-auth-service`
- `codexvanta-os-event-bus`
- `codexvanta-os-automation-core`
- `codexvanta-os-ai-engine`
- `codexvanta-os-decision-engine`
- `codexvanta-os-policy-engine`
- `codexvanta-os-governance-autonomy`
- `codexvanta-os-control-center`
- `codexvanta-os-fleet-sandbox`
- `codexvanta-os-core-code-deconstructor`
- `codexvanta-os-core-kernel`
- `codexvanta-os-core-main`
- `codexvanta-os-observability-stack`
- `codexvanta-os-infra-gitops`
- `codexvanta-os-infra-base`
- `codexvanta-os-app-portal`
- `codexvanta-os-app-ui`
- `codexvanta-os-module-suite`
- `codexvanta-os-workflows`

---

## Enforcement

This policy may be enforced by:

- CI linting
- registry validation
- GitHub Actions policy checks
- OPA / Rego policy
- pre-merge governance review