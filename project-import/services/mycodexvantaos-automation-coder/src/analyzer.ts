import type { AnalysisResult, Pattern, Issue, ComplexityReport, DependencyGraph, GraphNode, GraphEdge } from "./types";

export class AnalyzerService {
  analyze(code: string, file: string): AnalysisResult {
    const patterns = this.detectPatterns(code, file);
    const issues = this.detectIssues(code, file);
    const metrics = this.computeMetrics(code);
    return { patterns, issues, metrics };
  }

  computeComplexity(code: string): ComplexityReport {
    const lines = code.split("\n");
    const nonEmpty = lines.filter((l) => l.trim().length > 0).length;
    const branches = (code.match(/if\s*\(|else\s|switch\s*\(|case\s|for\s*\(|while\s*\(|\?\s/g) || []).length;
    const cyclomatic = branches + 1;
    const cognitive = branches + Math.floor(this.countNesting(code) * 0.5);

    return {
      cyclomatic,
      cognitive,
      halstead: {
        operators: (code.match(/[+\-*/%=<>!&|^~?:]+/g) || []).length,
        operands: (code.match(/\b\w+\b/g) || []).length,
        length: nonEmpty,
      },
      maintainability: Math.max(0, Math.min(100, 171 - 5.2 * Math.log(cyclomatic + 1) - 0.23 * nonEmpty)),
    };
  }

  buildDependencyGraph(files: { file: string; code: string }[]): DependencyGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    for (const { file, code } of files) {
      nodes.push({ id: file, type: "file", name: file });
      const imports = code.match(/from\s+["']([^"']+)["']/g) || [];
      for (const imp of imports) {
        const match = imp.match(/from\s+["']([^"']+)["']/);
        if (match) {
          const target = match[1];
          if (!nodes.find((n) => n.id === target)) {
            nodes.push({ id: target, type: "module", name: target });
          }
          edges.push({ from: file, to: target, type: "import" });
        }
      }
    }

    return { nodes, edges };
  }

  private detectPatterns(code: string, file: string): Pattern[] {
    const patterns: Pattern[] = [];
    const singletonMatch = code.match(/getInstance\s*\(/g);
    if (singletonMatch) {
      patterns.push({
        type: "design-pattern",
        name: "Singleton",
        occurrences: singletonMatch.length,
        locations: [{ file, line: 1 }],
      });
    }
    const observerMatch = code.match(/addEventListener|on\(|emit\(/g);
    if (observerMatch) {
      patterns.push({
        type: "design-pattern",
        name: "Observer",
        occurrences: observerMatch.length,
        locations: [{ file, line: 1 }],
      });
    }
    return patterns;
  }

  private detectIssues(code: string, file: string): Issue[] {
    const issues: Issue[] = [];
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 120) {
        issues.push({ severity: "warning", message: "Line exceeds 120 characters", file, line: i + 1 });
      }
      if (lines[i].includes("TODO") || lines[i].includes("FIXME")) {
        issues.push({ severity: "info", message: "Contains TODO/FIXME comment", file, line: i + 1 });
      }
      if (lines[i].includes("any")) {
        issues.push({ severity: "warning", message: "Usage of 'any' type detected", file, line: i + 1 });
      }
    }
    return issues;
  }

  private computeMetrics(code: string): Record<string, number> {
    const lines = code.split("\n");
    return {
      totalLines: lines.length,
      codeLines: lines.filter((l) => l.trim().length > 0 && !l.trim().startsWith("//")).length,
      commentLines: lines.filter((l) => l.trim().startsWith("//")).length,
      blankLines: lines.filter((l) => l.trim().length === 0).length,
      functions: (code.match(/function\s+\w+|=>\s*{/g) || []).length,
      classes: (code.match(/class\s+\w+/g) || []).length,
    };
  }

  private countNesting(code: string): number {
    let maxNesting = 0;
    let current = 0;
    for (const char of code) {
      if (char === "{") { current++; maxNesting = Math.max(maxNesting, current); }
      if (char === "}") { current = Math.max(0, current - 1); }
    }
    return maxNesting;
  }
}