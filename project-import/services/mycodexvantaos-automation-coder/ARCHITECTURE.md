# CodexVanta OS — Core Code Deconstructor Architecture

## Overview

The Core Code Deconstructor provides static analysis and dependency management capabilities for CodexVanta OS. It enables the platform to introspect its own codebase, detect architectural violations, and understand the impact of changes.

---

## Design Principles

1. **Self-aware platform** — CodexVanta OS can analyze its own source code. The deconstructor reads package.json files, TypeScript sources, and import graphs to build a complete picture.

2. **Graph-based analysis** — Dependencies are modeled as directed graphs. Cycle detection uses depth-first search with back-edge tracking. Impact analysis uses forward traversal from changed nodes.

3. **Cache-heavy** — AST parsing and graph construction are expensive. Results are cached in StateStoreProvider with content-hash-based invalidation.

---

## Dependency Graph Algorithm

```
Build Graph:
  1. Scan all package.json files
  2. Extract dependencies and devDependencies
  3. Build adjacency list (package → [dependencies])
  4. Return { nodes: Package[], edges: Dependency[] }

Find Cycles:
  1. DFS from each unvisited node
  2. Track visiting (in current path) vs visited (completed)
  3. Back edge detected → cycle found
  4. Return all detected cycles

Get Impact:
  1. Build reverse graph (dependency → dependents)
  2. BFS/DFS from changed package
  3. Collect all reachable packages
  4. Return impact set with depth levels
```

---

## Provider Usage Map

| Service | storage | database | stateStore | observability |
|---------|---------|----------|------------|---------------|
| ASTAnalyzerService | read files | results | AST cache | log |
| DependencyGraphService | — | graphs | graph cache | trace |

---

## Dependencies

- **Tier 4** in the CodexVanta OS dependency hierarchy
- Depends on: core-kernel, ai-engine (for AI-assisted pattern detection)
- Consumed by: governance-autonomy, control-center
