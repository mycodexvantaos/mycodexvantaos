# CodexvantaOS Multi-Repository Workflow Orchestration Design v2.0

**Version**: 2.0.0  
**Date**: 2024-03-13  
**Status**: Definitive  
**Architecture**: Native-first / Provider-agnostic  
**Philosophy**: 「第三方服務是平台的擴充出口，不是平台成立的地基。」

---

## 1. Executive Summary

This document defines the comprehensive workflow orchestration strategy for managing concurrent and parallel operations across all 25 CodexvantaOS repositories. Version 2.0 implements a fundamental architectural pivot from third-party-first to **Native-first / Provider-agnostic** design, where the platform achieves full operational capability with zero external dependencies, and third-party services serve exclusively as optional expansion outlets.

### Key Objectives

1. **Native-first Execution**: All orchestration capabilities work with zero external service dependencies
2. **Provider-agnostic Design**: Every external capability accessed through abstract interfaces with native fallbacks
3. **Three-mode Operation**: Native, Connected, and Hybrid modes with automatic detection
4. **Tiered Concurrent Execution**: 5-tier dependency graph enabling safe parallel execution across 25 repos
5. **Automatic Failover**: Seamless degradation from external to native providers on failure
6. **Full Observability**: Provider-agnostic logging, metrics, tracing, and alerting

### Architecture Comparison: v1 vs v2

| Aspect | v1 (Third-party-first) | v2 (Native-first) |
|--------|----------------------|-------------------|
| State Management | Hard Redis dependency | StateStoreProvider (native: memory+file / external: Redis) |
| Repo Operations | Hard GitHub API dependency | RepoProvider (native: local git / external: GitHub API) |
| Notifications | Hardcoded Slack | NotificationProvider (native: console+file / external: Slack/Teams) |
| Secrets | GitHub Secrets only | SecretsProvider (native: AES-256-GCM vault / external: GitHub/Vault) |
| Startup | Requires all secrets configured | `git clone && npm start` with zero config |
| Failure Mode | Workflow fails if Redis/GitHub unavailable | Auto-failover to native providers |
| Secret Names | `REDIS_HOST`, `GH_TOKEN` | `ORCH_STATE_HOST`, `ORCH_GITHUB_TOKEN` |

---

## 2. Architecture Overview

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              CodexvantaOS Orchestration Layer v2.0                   │
│              Native-first / Provider-agnostic                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              Phase 0: Mode Detection                          │ │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐                 │ │
│  │  │ Scan     │──▶│ Resolve  │──▶│ Output   │                 │ │
│  │  │ Secrets  │   │ Providers│   │ Config   │                 │ │
│  │  └──────────┘   └──────────┘   └──────────┘                 │ │
│  │  Detects: state_provider, repo_provider, notify_provider,    │ │
│  │           deploy_provider → operational_mode                  │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │              ProviderRegistry                                 │ │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐    │ │
│  │  │State   │ │Repo    │ │Deploy  │ │Notify  │ │Observe │    │ │
│  │  │Store   │ │Provider│ │Provider│ │Provider│ │Provider│    │ │
│  │  ├────────┤ ├────────┤ ├────────┤ ├────────┤ ├────────┤    │ │
│  │  │native: │ │native: │ │native: │ │native: │ │native: │    │ │
│  │  │mem+file│ │local   │ │local   │ │console │ │file+   │    │ │
│  │  │        │ │git CLI │ │process │ │+file   │ │console │    │ │
│  │  ├────────┤ ├────────┤ ├────────┤ ├────────┤ ├────────┤    │ │
│  │  │extern: │ │extern: │ │extern: │ │extern: │ │extern: │    │ │
│  │  │Redis   │ │GitHub  │ │GH      │ │Slack   │ │Datadog │    │ │
│  │  │        │ │API     │ │Actions │ │Teams   │ │NR      │    │ │
│  │  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘    │ │
│  │  + Database, Storage, Auth, Queue, Secrets, Validation,      │ │
│  │    Security (共 12 Providers)                                │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │           Tiered Execution Engine (5 Tiers)                   │ │
│  │                                                               │ │
│  │  Tier 0 ──▶ Tier 1 ──▶ Tier 2 ──▶ Tier 3 ──▶ Tier 4        │ │
│  │  (3 repos)  (6 repos)  (8 repos)  (6 repos)  (2 repos)      │ │
│  │  parallel   parallel   parallel   parallel   parallel        │ │
│  │  max: 5     max: 8     max: 8     max: 8     max: 5         │ │
│  │                                                               │ │
│  │  ┌─────────────────────────────────────────────────────┐     │ │
│  │  │ Per-repo: repository-runner.yml v2                   │     │ │
│  │  │ ├── validate (MANIFEST + naming + provider-agnostic) │     │ │
│  │  │ ├── sync (config alignment from control-center)      │     │ │
│  │  │ ├── deploy (mode-aware: native/connected/hybrid)     │     │ │
│  │  │ ├── rollback (git-based state reversion)             │     │ │
│  │  │ └── healthcheck (repo + manifest + git status)       │     │ │
│  │  └─────────────────────────────────────────────────────┘     │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │           Finalization & Reporting                             │ │
│  │  ├── Collect tier results                                     │ │
│  │  ├── Calculate overall status                                 │ │
│  │  ├── Provider-aware notification (native/slack/webhook)       │ │
│  │  └── Upload report artifact                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Repository Classification by Layer & Plane

| Layer | Plane | Repositories | Tier | Priority |
|-------|-------|-------------|------|----------|
| B-Runtime | Control | core-main, workflows | 0-1 | P0 |
| C-NativeServices | Control | control-center | 0 | P0 |
| B-Runtime | Execution | core-kernel, scheduler, automation-core | 0-2 | P1 |
| A-Builder | Execution | cli, core-code-deconstructor | 3 | P1 |
| E-DeployTarget | Execution | infra-base | 4 | P1 |
| C-NativeServices | Governance | secret-vault, config-manager, auth-service, policy-engine, governance-autonomy | 1-2 | P0 |
| D-Connector | Integration | network-mesh | 2 | P1 |
| B-Runtime | Integration | event-bus | 1 | P1 |
| E-DeployTarget | Integration | infra-gitops | 4 | P1 |
| B-Runtime | Data | data-pipeline | 2 | P2 |
| B-Runtime | Decision | ai-engine, decision-engine | 2 | P2 |
| B-Runtime | Experience | app-portal, app-ui, module-suite | 3 | P1 |
| C-NativeServices | Observability | observability-stack | 2 | P1 |
| B-Runtime | Sandbox | fleet-sandbox | 3 | P3 |

---

## 3. Concurrent Execution Model

### 3.1 Execution Phases

The orchestrator executes in 5 phases, with Phase 0 being the new mode detection phase introduced in v2:

```
Phase 0: Mode Detection (NEW in v2)
  ├── Scan available secrets (ORCH_GITHUB_TOKEN, ORCH_STATE_*, ORCH_SLACK_*)
  ├── Count external capabilities (0 = native, 3+ = connected, else = hybrid)
  ├── Resolve per-capability provider (state, repo, notify, deploy)
  └── Output: operational_mode + provider configuration

Phase 1: Preparation
  ├── Initialize orchestration context (run_id, timestamps)
  ├── Checkout control-center (using available token)
  ├── Install provider-aware dependencies (only what's needed)
  ├── Load registry configuration (repos.yaml, dependencies.yaml, queue-config.yaml)
  ├── Resolve tiered execution order from dependencies.yaml
  ├── Validate dependency integrity (YAML syntax, cross-references, ARCHITECTURE.md)
  └── Analyze affected repositories (filter by plane/repos if specified)

Phase 2: State Initialization
  ├── Provider selection based on Phase 0 detection
  ├── Native path: create JSON state file in RUNNER_TEMP
  ├── Redis path: connect, ping, set initial state with 86400s TTL
  ├── Failure handling: auto-fallback from Redis → native
  └── Output: state_initialized flag

Phase 3: Tiered Execution (Tier 0 → Tier 4)
  ├── Each tier runs as a separate job with matrix strategy
  ├── Repos within same tier execute in parallel (max_parallel configured)
  ├── Tiers execute sequentially (Tier N+1 waits for Tier N)
  ├── fail-fast: false (single repo failure doesn't block tier)
  ├── Each repo calls repository-runner.yml with provider config
  └── Provider configuration passed as workflow inputs

Phase 4: Finalization
  ├── Collect all tier results (success/failure/skipped)
  ├── Calculate overall status (success/partial_failure/mixed/skipped)
  ├── Persist report via state provider (native file or Redis)
  ├── Send notification via notify provider (native stdout, Slack, webhook)
  └── Upload report as GitHub Actions artifact (30-day retention)
```

### 3.2 Tiered Execution Detail

```
┌───────────────────────────────────────────────────────────────────┐
│                    Tier 0: Foundation                              │
│  ┌──────────────┐ ┌──────────────────┐ ┌───────────────┐        │
│  │ core-kernel   │ │ control-center    │ │ workflows     │        │
│  │ (B-Runtime)   │ │ (C-NativeServices)│ │ (B-Runtime)   │        │
│  └──────────────┘ └──────────────────┘ └───────────────┘        │
│  max_parallel: 5 | No upstream dependencies                      │
├───────────────────────────────────────────────────────────────────┤
│                    Tier 1: Core Services                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │core-main │ │event-bus │ │config-   │ │secret-   │           │
│  │          │ │          │ │ manager  │ │ vault    │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐                                      │
│  │auth-     │ │policy-   │                                      │
│  │ service  │ │ engine   │                                      │
│  └──────────┘ └──────────┘                                      │
│  max_parallel: 8 | Depends on: Tier 0                            │
├───────────────────────────────────────────────────────────────────┤
│                    Tier 2: Engines & Middleware                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │scheduler │ │automation│ │ai-engine │ │decision  │           │
│  │          │ │ -core    │ │          │ │ -engine  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │governance│ │observa-  │ │data-     │ │network-  │           │
│  │-autonomy │ │ bility   │ │ pipeline │ │ mesh     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  max_parallel: 8 | Depends on: Tier 0 + Tier 1                  │
├───────────────────────────────────────────────────────────────────┤
│                    Tier 3: Applications                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │app-portal│ │app-ui    │ │module-   │ │cli       │           │
│  │          │ │          │ │ suite    │ │          │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐                                      │
│  │code-     │ │fleet-    │                                      │
│  │deconstr. │ │ sandbox  │                                      │
│  └──────────┘ └──────────┘                                      │
│  max_parallel: 8 | Depends on: Tier 0 + 1 + 2                   │
├───────────────────────────────────────────────────────────────────┤
│                    Tier 4: Infrastructure                          │
│  ┌──────────┐ ┌──────────┐                                      │
│  │infra-base│ │infra-    │                                      │
│  │          │ │ gitops   │                                      │
│  └──────────┘ └──────────┘                                      │
│  max_parallel: 5 | Depends on: All upstream tiers                │
└───────────────────────────────────────────────────────────────────┘
```

### 3.3 Parallelism Configuration

| Tier | Max Parallel | Rationale |
|------|-------------|-----------|
| 0 | 5 | Foundation layer — small set, critical path |
| 1 | 8 | Core services — need fast parallel validation |
| 2 | 8 | Engines — largest tier, max throughput |
| 3 | 8 | Applications — independent from each other |
| 4 | 5 | Infrastructure — small set, final validation |

---

## 4. Provider-Agnostic State Management

### 4.1 State Provider Selection

```
┌─────────────────────────────────────────────────────────┐
│            State Provider Decision Tree                   │
│                                                          │
│  ORCH_STATE_PROVIDER = ?                                 │
│  ├── "native"  → Always use file-based state             │
│  ├── "redis"   → Attempt Redis, failover to native       │
│  └── "auto"    → Check secrets availability:             │
│      ├── ORCH_STATE_HOST present? → "redis"              │
│      └── Not present?            → "native"              │
│                                                          │
│  Runtime Failover:                                       │
│  Redis connection fails → Log warning → Switch to native │
│  Redis recovers         → (Stay on native until restart) │
└─────────────────────────────────────────────────────────┘
```

### 4.2 State Schema

```json
{
  "run_id": "orch-20240313-143022-42",
  "status": "running|success|partial_failure|failed",
  "mode": "native|connected|hybrid",
  "providers": {
    "state": "native|redis",
    "repo": "native|github",
    "notify": "native|slack|webhook",
    "deploy": "native|github-actions"
  },
  "started_at": "2024-03-13T14:30:22Z",
  "completed_at": "2024-03-13T14:45:33Z",
  "repositories": {
    "codexvanta-os-core-kernel": {
      "status": "success",
      "tier": 0,
      "layer": "B-Runtime",
      "plane": "Execution",
      "action": "validate",
      "started_at": "...",
      "completed_at": "..."
    }
  }
}
```

### 4.3 Native State Storage

- Location: `$RUNNER_TEMP/orch-state/`
- Format: JSON files per run and per repo
- Retention: Duration of GitHub Actions run (auto-cleaned)
- Report: Uploaded as artifact with 30-day retention

### 4.4 Redis State Storage (when available)

- Key pattern: `orch:{run_id}:state` and `orch:repo:{repo}:{exec_id}`
- State TTL: 86400s (24 hours)
- Report TTL: 604800s (7 days)
- Connection: TLS-enabled, password-authenticated

---

## 5. Provider Configuration

### 5.1 Configuration Hierarchy

```
Priority (highest to lowest):
1. workflow_dispatch inputs (mode override)
2. GitHub Repository Variables (vars.ORCH_*_PROVIDER)
3. Automatic detection from secrets availability
4. Default: native (always works)
```

### 5.2 GitHub Repository Variables

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `ORCH_STATE_PROVIDER` | auto, native, redis | auto | State management backend |
| `ORCH_REPO_PROVIDER` | auto, native, github, gitlab | auto | Repository operations backend |
| `ORCH_NOTIFY_PROVIDER` | auto, native, slack, webhook, teams | auto | Notification delivery backend |
| `ORCH_DEPLOY_PROVIDER` | auto, native, github-actions, docker, k8s | auto | Deployment execution backend |

### 5.3 GitHub Repository Secrets (all optional)

| Secret | Purpose | Enables |
|--------|---------|---------|
| `ORCH_GITHUB_TOKEN` | GitHub API access | github repo provider |
| `ORCH_STATE_HOST` | Redis host | redis state provider |
| `ORCH_STATE_PORT` | Redis port | redis state provider |
| `ORCH_STATE_PASSWORD` | Redis password | redis state provider |
| `ORCH_SLACK_WEBHOOK` | Slack webhook URL | slack notify provider |
| `ORCH_SLACK_TOKEN` | Slack bot token | slack notify provider |

### 5.4 Mode Auto-Detection Logic

```python
external_count = sum([
    bool(ORCH_GITHUB_TOKEN),      # +1 if present
    bool(ORCH_STATE_HOST and ORCH_STATE_PORT and ORCH_STATE_PASSWORD),  # +1 if all present
    bool(ORCH_SLACK_WEBHOOK or ORCH_SLACK_TOKEN)  # +1 if any present
])

if external_count == 0:
    mode = "native"       # Zero external dependencies
elif external_count >= 3:
    mode = "connected"    # All external services available
else:
    mode = "hybrid"       # Partial external services
```

---

## 6. Repository Runner Actions

### 6.1 Validate Action

The validate action performs comprehensive checks on each repository:

1. **Repository Accessibility**: Can the repo be checked out?
2. **REPO_MANIFEST.yaml**: Present, valid YAML, contains required fields (layer, plane, tier)
3. **README.md**: Present in repository root
4. **Naming Convention**: Repository name starts with `codexvanta-os-`
5. **Config Files**: package.json and tsconfig.json are valid (if present)
6. **Provider-Agnostic Check** (NEW in v2): Scans source code for hard-coded external service references:
   - `redis://localhost`, `redis://127.0.0.1`
   - `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
   - `process.env.REDIS`
   - Flags warnings for any hard-coded dependencies

### 6.2 Sync Action

Synchronizes repository configuration from control-center:

1. Compare REPO_MANIFEST.yaml with control-center version
2. Copy updated MANIFEST if newer
3. Verify README.md architecture section
4. Commit changes (if repo_provider is github, push to remote)
5. In dry_run mode: report changes without applying

### 6.3 Deploy Action

Mode-aware deployment execution:

- **Native Mode**: Install deps → Build → Test → Deploy locally
- **Connected Mode**: Install deps → Build → Test → Container → Registry → Platform deploy
- **Hybrid Mode**: Native build → Deploy to available targets

### 6.4 Rollback Action

Git-based state reversion:

1. Find last known-good commit (before last orchestrator commit)
2. In dry_run mode: report rollback target
3. In live mode: `git reset --hard` to target commit

### 6.5 Healthcheck Action

Repository health verification:

1. Repository accessible (checkout succeeds)
2. REPO_MANIFEST.yaml present
3. README.md present
4. No broken symlinks
5. Git repository initialized

---

## 7. Error Handling & Failover

### 7.1 Provider Failover Chain

```
External Provider Init
  ├── Success → Use External
  └── Failure → Log Warning → Init Native Provider
                  ├── Success → Use Native (degraded mode)
                  └── Failure → CRITICAL ERROR (should never happen)
```

### 7.2 Workflow Error Isolation

| Scope | Failure Behavior | Impact |
|-------|-----------------|--------|
| Single repo in tier | Marked as failed, others continue | `fail-fast: false` |
| Entire tier | Next tier still runs | Results in `partial_failure` |
| State provider | Auto-failover to native | Transparent to workflow |
| Notification provider | Log to stdout as fallback | Non-blocking |
| Repo provider | Checkout uses `github.token` | Continue with GITHUB_TOKEN |

### 7.3 Retry Strategy

| Operation | Max Retries | Backoff | Fallback |
|-----------|------------|---------|----------|
| Redis connect | 1 | N/A | Native state |
| Slack notify | 1 | N/A | Stdout log |
| Repo checkout | 1 (built-in) | N/A | continue-on-error |
| Validation | 0 | N/A | Mark as failed |

---

## 8. Observability

### 8.1 Logging

Every phase and step produces structured log output:

```
🔍 Detecting operational mode...
  ✅ GitHub Token: available
  ⚪ Redis: not configured (will use native state store)
  ⚪ Slack: not configured (will use native notifications)
  🔄 Auto-detected mode: hybrid (1 external providers)
  📋 Provider summary: hybrid|state=native|repo=github|notify=native|deploy=native
```

### 8.2 Reports

- **Per-run report**: JSON with overall status, tier results, provider summary
- **Per-repo report**: JSON with action results, timestamps, layer/plane info
- **Artifact upload**: GitHub Actions artifact with 30-day retention

### 8.3 Metrics (Future)

Planned metrics for ObservabilityProvider integration:

- `orchestration.duration_seconds` (histogram)
- `orchestration.tier.duration_seconds` (histogram, labeled by tier)
- `orchestration.repo.status` (counter, labeled by repo and status)
- `orchestration.provider.failover_total` (counter, labeled by capability)

---

## 9. Migration Guide (v1 → v2)

### 9.1 Breaking Changes

| Change | v1 | v2 | Migration |
|--------|----|----|-----------|
| Secrets naming | `REDIS_HOST`, `GH_TOKEN` | `ORCH_STATE_HOST`, `ORCH_GITHUB_TOKEN` | Rename in GitHub Secrets |
| Required secrets | All mandatory | All optional | Remove mandatory checks |
| Workflow inputs | action, target_planes, repos | + mode, dry_run | Update dispatch callers |
| Runner inputs | tier, plane, dependencies | + mode, state_provider, repo_provider | Internal (auto-propagated) |

### 9.2 Step-by-Step Migration

1. **Rename secrets** in GitHub repository settings:
   - `REDIS_HOST` → `ORCH_STATE_HOST`
   - `REDIS_PORT` → `ORCH_STATE_PORT`
   - `REDIS_PASSWORD` → `ORCH_STATE_PASSWORD`
   - `GH_TOKEN` → `ORCH_GITHUB_TOKEN`

2. **Deploy REPO_MANIFEST.yaml** to all 25 repositories (generated by restructure script)

3. **Update workflow files**:
   - Replace `orchestrator.yml` with v2
   - Replace `repository-runner.yml` with v2

4. **Set provider variables** (optional):
   - `vars.ORCH_STATE_PROVIDER = auto`
   - `vars.ORCH_REPO_PROVIDER = auto`
   - `vars.ORCH_NOTIFY_PROVIDER = auto`
   - `vars.ORCH_DEPLOY_PROVIDER = auto`

5. **Test in Native Mode** first (remove all optional secrets temporarily)

6. **Re-enable external services** one by one to verify Hybrid → Connected transition

### 9.3 Backward Compatibility

- Renamed `ORCH_*` secrets work identically to old `REDIS_*` / `GH_TOKEN` secrets
- Setting no `ORCH_*_PROVIDER` variables → auto-detection (backward compatible)
- Missing REPO_MANIFEST.yaml → degraded validation (non-blocking)
- All new inputs have sensible defaults (mode=auto, dry_run=false)

---

## 10. Change History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-03-12 | Initial design (GitHub Actions + Redis + Slack hard dependencies) |
| 2.0.0 | 2024-03-13 | **Architecture Pivot**: Native-first / Provider-agnostic redesign. Added Phase 0 mode detection, 12 Provider interfaces, automatic failover, provider-agnostic state management, mode-aware deployment, REPO_MANIFEST.yaml standard, provider-agnostic validation checks. Removed all hard external service dependencies. |