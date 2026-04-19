/**
 * CodexvantaOS — core-code-deconstructor / DependencyGraphService
 * Dependency graph construction and analysis
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface DepNode { id: string; name: string; type: 'package' | 'module' | 'file' | 'class' | 'function'; version?: string; }
export interface DepEdge { from: string; to: string; type: 'imports' | 'depends' | 'extends' | 'implements'; }
export interface DepGraph { nodes: DepNode[]; edges: DepEdge[]; cycles: string[][]; stats: { nodeCount: number; edgeCount: number; cycleCount: number; maxDepth: number }; }

export class DependencyGraphService {
  private get providers() { return getProviders(); }

  async buildGraph(repoName: string): Promise<DepGraph> {
    const nodes: DepNode[] = [];
    const edges: DepEdge[] = [];
    // Read package.json dependencies
    try {
      const pkgFile = await this.providers.repo.getFile(repoName, 'package.json');
      if (pkgFile) {
        const pkg = JSON.parse(pkgFile.content);
        nodes.push({ id: pkg.name, name: pkg.name, type: 'package', version: pkg.version });
        for (const [dep, ver] of Object.entries(pkg.dependencies ?? {})) {
          nodes.push({ id: dep, name: dep, type: 'package', version: ver as string });
          edges.push({ from: pkg.name, to: dep, type: 'depends' });
        }
      }
    } catch { /* skip */ }
    const cycles = this.detectCycles(nodes, edges);
    const graph: DepGraph = { nodes, edges, cycles, stats: { nodeCount: nodes.length, edgeCount: edges.length, cycleCount: cycles.length, maxDepth: this.calculateMaxDepth(nodes, edges) } };
    await this.providers.stateStore.set(`decon:graph:${repoName}`, graph);
    this.providers.observability.info('Dependency graph built', { repo: repoName, nodes: nodes.length, edges: edges.length });
    return graph;
  }

  async getGraph(repoName: string): Promise<DepGraph | null> { return (await this.providers.stateStore.get<DepGraph>(`decon:graph:${repoName}`))?.value ?? null; }

  async findDependents(nodeId: string, repoName: string): Promise<string[]> {
    const graph = await this.getGraph(repoName);
    if (!graph) return [];
    return graph.edges.filter(e => e.to === nodeId).map(e => e.from);
  }

  async findDependencies(nodeId: string, repoName: string): Promise<string[]> {
    const graph = await this.getGraph(repoName);
    if (!graph) return [];
    return graph.edges.filter(e => e.from === nodeId).map(e => e.to);
  }

  private detectCycles(nodes: DepNode[], edges: DepEdge[]): string[][] {
    const cycles: string[][] = [];
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacency.has(edge.from)) adjacency.set(edge.from, []);
      adjacency.get(edge.from)!.push(edge.to);
    }
    const visited = new Set<string>(); const inStack = new Set<string>();
    const dfs = (node: string, path: string[]) => {
      if (inStack.has(node)) { cycles.push([...path.slice(path.indexOf(node)), node]); return; }
      if (visited.has(node)) return;
      visited.add(node); inStack.add(node);
      for (const next of (adjacency.get(node) ?? [])) dfs(next, [...path, node]);
      inStack.delete(node);
    };
    for (const node of nodes) dfs(node.id, []);
    return cycles;
  }

  private calculateMaxDepth(nodes: DepNode[], edges: DepEdge[]): number {
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) { if (!adjacency.has(edge.from)) adjacency.set(edge.from, []); adjacency.get(edge.from)!.push(edge.to); }
    const depths = new Map<string, number>();
    const getDepth = (node: string, visited: Set<string>): number => {
      if (visited.has(node)) return 0;
      if (depths.has(node)) return depths.get(node)!;
      visited.add(node);
      const children = adjacency.get(node) ?? [];
      const depth = children.length === 0 ? 0 : 1 + Math.max(...children.map(c => getDepth(c, new Set(visited))));
      depths.set(node, depth);
      return depth;
    };
    let maxDepth = 0;
    for (const node of nodes) maxDepth = Math.max(maxDepth, getDepth(node.id, new Set()));
    return maxDepth;
  }
}
