# Fleet Sandbox — Architecture Document

## Purpose

`fleet-sandbox` provides isolated execution environments for safely running multi-repository operations. It ensures that builds, tests, scans, and deployments execute in controlled contexts without side effects on the host system or concurrent operations.

## Sandbox Lifecycle

```
┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│ Create   │──▶│ Provision│──▶│ Execute  │──▶│ Collect  │──▶│ Destroy  │
│          │   │ Workspace│   │ Commands │   │ Artifacts│   │ Cleanup  │
└──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

## Isolation Model

### Native Mode

```
Host Filesystem
├── /tmp/sandbox-{id}/
│   ├── workspace/          # Cloned repositories
│   ├── artifacts/          # Build outputs
│   ├── logs/               # Execution logs
│   └── .sandbox-config     # Resource limits
```

- Process-level isolation via child_process with UID/GID mapping
- Filesystem isolation via tmpdir with controlled symlinks
- Resource limits via OS-level process controls

### Connected Mode

```
Container Runtime
├── sandbox-{id}
│   ├── Image: codexvanta/sandbox-runner
│   ├── Volumes: workspace, artifacts
│   ├── Limits: CPU, Memory, Disk
│   └── Network: isolated or host
```

## Resource Management

| Resource | Native Limit | Connected Limit |
|---|---|---|
| CPU | Process priority (nice) | Container CPU shares |
| Memory | Node.js --max-old-space-size | Container memory limit |
| Disk | Quota via cleanup threshold | Volume size limit |
| Time | setTimeout-based watchdog | Container runtime timeout |
| Network | None (process-level) | Container network policy |

## Parallel Execution

```
┌─────────────────────┐
│   Sandbox Pool      │
│   (max_concurrent)  │
│                     │
│  ┌────┐ ┌────┐     │
│  │ S1 │ │ S2 │     │  Running
│  └────┘ └────┘     │
│                     │
│  ┌────┐ ┌────┐     │
│  │ S3 │ │ S4 │     │  Queued
│  └────┘ └────┘     │
└─────────────────────┘
```

## Artifact Collection

After execution completes, the Artifact Collector extracts:
- Build outputs (dist/, build/)
- Test results (junit.xml, coverage/)
- Logs (stdout, stderr, execution timeline)
- Custom artifacts (user-defined glob patterns)

All artifacts are stored via StorageProvider for downstream consumption.

## Error Handling

- **Execution Timeout** — Kill process/container, collect partial artifacts, report timeout
- **Resource Exhaustion** — Terminate sandbox, log resource usage at failure point
- **Provisioning Failure** — Retry once, then fail with diagnostic information
- **Cleanup Failure** — Log warning, schedule deferred cleanup

## Design Principles

1. **Isolation First** — No sandbox can affect host or other sandboxes
2. **Deterministic Setup** — Same specification always produces same initial state
3. **Cleanup Guarantees** — Resources always freed, even on crash
4. **Observable Execution** — Full execution timeline with resource metrics
5. **Provider-Agnostic** — Same API for local tmpdir or container-based sandboxes
