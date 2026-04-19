# Policy Engine — Architecture Document

## Purpose

`policy-engine` provides the declarative policy framework for CodexVanta OS. It compiles YAML policy definitions into executable rules, evaluates repository state against those rules, and produces structured violation reports.

## Policy Definition Model

```yaml
policy:
  name: "security-baseline"
  version: "1.0.0"
  category: "security"
  severity: "high"
  
  rules:
    - id: "SEC-001"
      description: "No secrets in source code"
      check:
        type: "file-content"
        pattern: "(password|secret|api_key)\\s*=\\s*['&quot;][^'&quot;]+['&quot;]"
        exclude: ["*.test.*", "*.example.*"]
      remediation: "Use SecretsProvider instead of hardcoded values"
    
    - id: "SEC-002"
      description: "Dependencies must be pinned"
      check:
        type: "dependency-version"
        constraint: "exact"
      remediation: "Pin dependency versions in package.json"
```

## Compilation Pipeline

```
YAML Policy
     │
     ▼
┌──────────────┐
│ Schema       │ ← Validate policy structure
│ Validation   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Rule         │ ← Convert to executable rules
│ Compilation  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Optimization │ ← Merge overlapping checks
│              │
└──────┬───────┘
       │
       ▼
  Compiled Policy Set
  (cached for reuse)
```

## Evaluation Flow

```
Repository State
     │
     ├── File tree
     ├── Dependencies
     ├── Configuration
     ├── Scan results
     └── Metadata
          │
          ▼
┌──────────────────────┐
│ Compiled Policy Set  │
│                      │
│ Rule 1: ✅ Pass      │
│ Rule 2: ❌ Violation │
│ Rule 3: ✅ Pass      │
│ Rule 4: ⚠️ Warning   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Evaluation Result    │
│                      │
│ score: 75/100        │
│ violations: 1        │
│ warnings: 1          │
│ details: [...]       │
└──────────────────────┘
```

## Policy Categories

| Category | Scope | Examples |
|---|---|---|
| Security | Code & infrastructure | Secret detection, dependency vulnerabilities |
| Compliance | Organizational | License compliance, data handling |
| Code Quality | Source code | Complexity limits, test coverage |
| Infrastructure | Deployment | Resource limits, network policies |
| Operational | Runtime | Logging requirements, health checks |

## Violation Severity Levels

| Level | Description | Governance Action |
|---|---|---|
| Critical | Immediate security risk | Block + escalate |
| High | Significant policy breach | Block + approval gate |
| Medium | Notable deviation | Warn + track |
| Low | Minor improvement | Inform |
| Info | Suggestion | Log only |

## Design Principles

1. **Declarative Policies** — Policies are data (YAML), not code
2. **Deterministic Evaluation** — Same state + same policies = same results
3. **Fast Evaluation** — Compiled policies with caching for sub-second evaluation
4. **Remediation Guidance** — Every violation includes actionable remediation steps
5. **Composable Policy Sets** — Build complex policies from simple, reusable rules
