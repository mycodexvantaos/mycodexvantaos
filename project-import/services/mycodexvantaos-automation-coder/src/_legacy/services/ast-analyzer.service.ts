/**
 * CodexvantaOS — core-code-deconstructor / ASTAnalyzerService
 * Source code AST analysis
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface ASTNode { type: string; name?: string; children: ASTNode[]; location?: { line: number; column: number }; metadata?: Record<string, unknown>; }
export interface AnalysisResult { file: string; language: string; rootNode: ASTNode; stats: { functions: number; classes: number; imports: number; exports: number; lineCount: number }; analyzedAt: number; }

export class ASTAnalyzerService {
  private get providers() { return getProviders(); }

  async analyzeFile(filePath: string, content?: string): Promise<AnalysisResult> {
    if (!content) {
      const file = await this.providers.storage.get(filePath);
      content = new TextDecoder().decode(file.data);
    }
    const language = this.detectLanguage(filePath);
    const lines = content.split('\n');
    const rootNode = this.parseToAST(content, language);
    const stats = this.computeStats(content, language);
    const result: AnalysisResult = { file: filePath, language, rootNode, stats, analyzedAt: Date.now() };
    await this.providers.stateStore.set(`decon:analysis:${this.hashPath(filePath)}`, result, { ttl: 3600 });
    this.providers.observability.info('AST analysis complete', { file: filePath, language, ...stats });
    return result;
  }

  async analyzeRepo(repoName: string): Promise<AnalysisResult[]> {
    const results: AnalysisResult[] = [];
    const files = await this.providers.storage.list({ prefix: `repos/${repoName}/src` });
    for (const file of files.objects) {
      if (file.key.match(/\.(ts|js|py)$/)) {
        results.push(await this.analyzeFile(file.key));
      }
    }
    return results;
  }

  private parseToAST(content: string, language: string): ASTNode {
    // Simplified AST parser for native mode
    const root: ASTNode = { type: 'Program', children: [] };
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ')) root.children.push({ type: 'ImportDeclaration', name: line, children: [], location: { line: i + 1, column: 0 } });
      else if (line.startsWith('export ')) root.children.push({ type: 'ExportDeclaration', name: line, children: [], location: { line: i + 1, column: 0 } });
      else if (line.match(/^(export\s+)?(async\s+)?function\s+/)) root.children.push({ type: 'FunctionDeclaration', name: line.match(/function\s+(\w+)/)?.[1], children: [], location: { line: i + 1, column: 0 } });
      else if (line.match(/^(export\s+)?class\s+/)) root.children.push({ type: 'ClassDeclaration', name: line.match(/class\s+(\w+)/)?.[1], children: [], location: { line: i + 1, column: 0 } });
    }
    return root;
  }

  private computeStats(content: string, language: string): { functions: number; classes: number; imports: number; exports: number; lineCount: number } {
    const lines = content.split('\n');
    return {
      functions: (content.match(/function\s+\w+/g) ?? []).length + (content.match(/=>\s*{/g) ?? []).length,
      classes: (content.match(/class\s+\w+/g) ?? []).length,
      imports: (content.match(/^import\s+/gm) ?? []).length,
      exports: (content.match(/^export\s+/gm) ?? []).length,
      lineCount: lines.length,
    };
  }

  private detectLanguage(path: string): string {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) return 'typescript';
    if (path.endsWith('.js') || path.endsWith('.jsx')) return 'javascript';
    if (path.endsWith('.py')) return 'python';
    return 'unknown';
  }

  private hashPath(path: string): string {
    let hash = 0;
    for (let i = 0; i < path.length; i++) { hash = ((hash << 5) - hash) + path.charCodeAt(i); hash |= 0; }
    return Math.abs(hash).toString(36);
  }
}
