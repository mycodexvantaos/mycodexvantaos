# CodexVanta OS — Core Code Deconstructor

**codexvanta-os-core-code-deconstructor** is the static analysis and dependency graph service of CodexVanta OS. It provides AST analysis, pattern detection, dependency graph construction, and impact analysis through a provider-agnostic interface.

---

## Purpose

The Core Code Deconstructor enables CodexVanta OS to understand its own codebase. It parses source files into abstract syntax trees, detects architectural patterns, builds dependency graphs across packages, and performs impact analysis for proposed changes.

---

## Core Capabilities

### AST Analyzer Service
- Source file parsing to abstract syntax trees
- Pattern detection (imports, exports, class hierarchies)
- Code quality analysis and reporting
- Multi-language AST support (TypeScript primary)

### Dependency Graph Service
- Cross-package dependency graph construction from package.json
- Circular dependency detection via depth-first search
- Change impact analysis (what breaks if X changes)
- Build order calculation from dependency topology

---

## Architecture

```
┌─────────────────────────────────────────────┐
│       Core Code Deconstructor                │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │ASTAnalyzerService│  │DepGraphService  │  │
│  └────────┬─────────┘  └───────┬─────────┘  │
│           │                     │            │
│  ┌────────┴─────────────────────┴────────┐   │
│  │          Provider Layer               │   │
│  │  storage · database · stateStore      │   │
│  │  observability                        │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

---

## Provider Dependencies

| Provider | Usage |
|----------|-------|
| storage | Read source files for analysis |
| database | Persist dependency graphs and analysis results |
| stateStore | Cache parsed ASTs and graph computations |
| observability | Log analysis operations, trace graph builds |

---

## Services

| Service | Methods | Description |
|---------|---------|-------------|
| ASTAnalyzerService | analyze, getAST, findPatterns, getReport | Static code analysis |
| DependencyGraphService | build, getGraph, findCycles, getImpact | Dependency analysis |

---

## Tier

**Tier 4** — Depends on core-kernel, ai-engine

---

## Philosophy

> The platform understands its own code natively.
> External analysis tools are optional enhancements to built-in introspection.

---

## License

MIT — see LICENSE
