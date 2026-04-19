# CodexvantaOS Workflow Guide

## Overview

This guide provides comprehensive documentation for the multi-repository orchestration workflow system used across all 25 CodexvantaOS repositories.

## Architecture

The orchestration system consists of:

1. **Master Orchestrator** (`orchestrator.yml`)
   - Coordinates execution across all repositories
   - Manages 4 execution phases
   - Handles error recovery and rollback

2. **Repository Runner** (`repository-runner.yml`)
   - Executes actions on individual repositories
   - Manages repository-level state
   - Handles repository-specific errors

3. **Orchestration Scripts**
   - Dependency resolution and validation
   - State management with Redis
   - Rollback orchestration
   - Report generation and metrics

## Workflow Structure

```
codexvanta-os-workflows/
├── .github/
│   └── workflows/
│       ├── orchestrator.yml          # Master orchestrator
│       ├── repository-runner.yml     # Repository execution
│       └── validate-naming.yml       # Naming validation
```

## Execution Planes

### Plane Definitions

1. **Control Plane** (Priority: P0)
   - Repositories: `codexvanta-os-control-center`, `codexvanta-os-core-main`
   - Concurrency: 2
   - Rollback: Automatic

2. **Governance Plane** (Priority: P1)
   - Repositories: `codexvanta-os-policy-engine`, `codexvanta-os-audit-trail`
   - Concurrency: 5
   - Rollback: Automatic

3. **Execution Plane** (Priority: P1)
   - Repositories: Core kernel, runtime, job scheduler
   - Concurrency: 6
   - Rollback: Automatic

4. **Integration Plane** (Priority: P2)
   - Repositories: API gateway, service mesh, event bus
   - Concurrency: 3
   - Rollback: Manual

5. **Data Plane** (Priority: P2)
   - Repositories: Data lake, warehouse, processing
   - Concurrency: 4
   - Rollback: Manual (with approval)

6. **Decision Plane** (Priority: P2)
   - Repositories: AI engine, decision engine, analytics
   - Concurrency: 3
   - Rollback: Automatic

7. **Experience Plane** (Priority: P3)
   - Repositories: UI kit, web frontend, mobile app
   - Concurrency: 4
   - Rollback: Manual (production)

8. **Observability Plane** (Priority: P3)
   - Repositories: Metrics, logging, tracing
   - Concurrency: 3
   - Rollback: Automatic

9. **Sandbox Plane** (Priority: P3)
   - Repositories: Development, testing, playground
   - Concurrency: 5
   - Rollback: Automatic

## Usage

### Manual Execution

Trigger the orchestrator workflow manually:

```bash
gh workflow run orchestrator.yml \
  -f action=sync \
  -f target_planes="" \
  -f repositories="" \
  -f force=false \
  -f dry_run=false
```

### Actions Available

1. **sync**
   - Synchronize repositories
   - Update configurations
   - Apply governance policies

2. **deploy**
   - Deploy new versions
   - Apply database migrations
   - Update infrastructure

3. **validate**
   - Validate naming conventions
   - Check dependencies
   - Verify configurations

4. **rollback**
   - Rollback failed deployments
   - Restore previous state
   - Execute rollback plan

### Targeting Specific Planes

Execute only specific planes:

```bash
gh workflow run orchestrator.yml \
  -f action=deploy \
  -f target_planes="control-plane,governance-plane"
```

### Targeting Specific Repositories

Execute specific repositories:

```bash
gh workflow run orchestrator.yml \
  -f action=deploy \
  -f repositories="codexvanta-os-core-kernel,codexvanta-os-runtime"
```

### Dry Run Mode

Test execution without making changes:

```bash
gh workflow run orchestrator.yml \
  -f action=sync \
  -f dry_run=true
```

## Configuration Files

### dependencies.yaml

Defines dependencies between repositories:

```yaml
dependencies:
  - source: codexvanta-os-infra-base
    targets:
      - codexvanta-os-infra-gitops
      - codexvanta-os-core-kernel
    type: must_precede
    criticality: critical
```

### queue-config.yaml

Defines queue configuration for each plane:

```yaml
queues:
  control-plane:
    priority: 0
    max_concurrent: 2
    execution_timeout: 600
    repositories: [...]
```

## Scripts

### resolve-order.py

Resolves dependencies and calculates execution order:

```bash
python3 scripts/orchestration/resolve-order.py \
  --deps-file registry/dependencies.yaml \
  --queue-file registry/queue-config.yaml \
  --action sync \
  --output execution_order.json
```

### validate-dependencies.py

Validates dependency configuration:

```bash
python3 scripts/orchestration/validate-dependencies.py \
  --deps-file registry/dependencies.yaml \
  --repos-file registry/repos.yaml
```

### state-manager.py

Manages orchestration state:

```bash
# Initialize orchestration
python3 scripts/orchestration/state-manager.py init \
  --orchestration-id <id> \
  --config config.json

# Update repository state
python3 scripts/orchestration/state-manager.py update \
  --orchestration-id <id> \
  --repository <repo> \
  --status completed

# Get orchestration state
python3 scripts/orchestration/state-manager.py get \
  --orchestration-id <id>

# Sync orchestration
python3 scripts/orchestration/state-manager.py sync \
  --orchestration-id <id>
```

### rollback-manager.py

Manages rollback operations:

```bash
python3 scripts/orchestration/rollback-manager.py \
  --deps-file registry/dependencies.yaml \
  --queue-file registry/queue-config.yaml \
  --repository <failed-repo> \
  --orchestration-id <id> \
  --reason "Deployment failed" \
  --execute
```

### generate-report.py

Generates execution reports:

```bash
python3 scripts/orchestration/generate-report.py \
  --orchestration-id <id> \
  --output execution-report.html
```

### publish-metrics.py

Publishes orchestration metrics:

```bash
python3 scripts/orchestration/publish-metrics.py \
  --orchestration-id <id> \
  --state-file state.json
```

### verify-consistency.py

Verifies orchestration consistency:

```bash
python3 scripts/orchestration/verify-consistency.py \
  --orchestration-id <id> \
  --state-dir ./states \
  --deps-file registry/dependencies.yaml \
  --repos-file registry/repos.yaml
```

## Monitoring and Observability

### Execution Monitoring

Monitor orchestration execution:

```bash
# List active orchestrations
python3 scripts/orchestration/state-manager.py list

# Get specific orchestration status
python3 scripts/orchestration/state-manager.py get \
  --orchestration-id <id>
```

### Viewing Reports

Access execution reports:
- HTML reports: Uploaded as artifacts
- Metrics: Published to Prometheus/CloudWatch
- Logs: Available in GitHub Actions logs

### Failure Detection

Common failure scenarios:
1. Circular dependencies
2. Missing repositories
3. Configuration errors
4. Execution timeouts
5. Resource limits exceeded

## Troubleshooting

### Common Issues

**Issue: Circular dependency detected**
- Solution: Review dependencies.yaml and remove circular references

**Issue: Repository not found in registry**
- Solution: Add repository to repos.yaml in control-center

**Issue: Execution timeout**
- Solution: Increase timeout in queue-config.yaml or optimize repository workflow

**Issue: Rollback failed**
- Solution: Check rollback strategy in queue-config.yaml and verify repository capabilities

### Debug Mode

Enable debug logging:

```yaml
env:
  LOG_LEVEL: debug
```

### Rollback Procedures

Automatic rollback triggers:
- Execution failure in auto-rollback plane
- Dependency chain breakage
- SLA violation

Manual rollback steps:
1. Identify failed repository
2. Calculate rollback order
3. Execute rollback by plane
4. Verify rollback completion

## Best Practices

1. **Always validate dependencies** before execution
2. **Use dry run mode** for testing changes
3. **Monitor execution** in real-time
4. **Review reports** after each execution
5. **Keep configurations updated** with repository changes
6. **Document custom configurations** for future reference
7. **Test rollback procedures** regularly
8. **Monitor metrics** for performance trends

## Security Considerations

1. **Secret Management**: Use GitHub Secrets for sensitive data
2. **Access Control**: Limit workflow execution to authorized users
3. **State Encryption**: Enable Redis encryption for state storage
4. **Audit Logging**: Maintain audit trail for all orchestration operations
5. **Policy Enforcement**: Use OPA policies for governance

## Support and Maintenance

### Documentation Updates
- Update this guide when adding new features
- Document custom configurations
- Maintain change log

### Regular Maintenance
- Review and update dependencies quarterly
- Validate configuration monthly
- Test rollback procedures weekly
- Monitor performance metrics daily

## References

- Orchestration Policy: `governance/ORCHESTRATION_POLICY.md`
- Multi-Repo Orchestration Design: `architecture/workflows/multi-repo-orchestration.md`
- Naming Policy: `governance/NAMING.md`
- Dependencies Configuration: `registry/dependencies.yaml`
- Queue Configuration: `registry/queue-config.yaml`