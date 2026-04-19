/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface ASTNode { type: string; name?: string; children: ASTNode[]; location: { start: number; end: number; line: number }; }

export interface AnalysisResult { patterns: Pattern[]; issues: Issue[]; metrics: Record<string, number>; }

export interface Pattern { type: string; name: string; occurrences: number; locations: { file: string; line: number }[]; }

export interface Symbol { name: string; type: "function" | "class" | "variable" | "interface" | "type"; exported: boolean; file: string; }

export interface Issue { severity: "info" | "warning" | "error"; message: string; file: string; line: number; }

export interface ComplexityReport { cyclomatic: number; cognitive: number; halstead: Record<string, number>; maintainability: number; }

export interface DependencyGraph { nodes: GraphNode[]; edges: GraphEdge[]; }

export interface GraphNode { id: string; type: string; name: string; }

export interface GraphEdge { from: string; to: string; type: "import" | "extends" | "implements" | "uses"; }

export interface ImpactAnalysis { directDeps: string[]; transitiveDeps: string[]; affectedTests: string[]; riskLevel: "low" | "medium" | "high"; }
