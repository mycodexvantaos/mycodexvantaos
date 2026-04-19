/**
 * Native Framework Detection Provider
 * 
 * 零外部依賴的框架檢測實現
 * 使用本地文件解析、正則匹配、AST 解析
 * 
 * 完全可離線運行
 */

import {
  FrameworkDetectionCapability,
  DetectionOptions,
  DetectionResult,
  DetectedFramework,
  DetectedLanguage,
  DetectedTool,
  ProjectStructure,
  FrameworkRule,
  BUILTIN_FRAMEWORK_RULES,
  HealthCheckResult,
} from '@mycodexvantaos/capabilities';

import * as fs from 'fs';
import * as path from 'path';

/**
 * Native 框架檢測配置
 */
export interface NativeFrameworkDetectionConfig {
  /**
   * 自定義框架規則
   */
  customRules?: FrameworkRule[];
  
  /**
   * 是否使用快取
   */
  enableCache?: boolean;
  
  /**
   * 快取 TTL（秒）
   */
  cacheTtl?: number;
}

/**
 * 文件擴展名到語言的映射
 */
const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.swift': 'Swift',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.h': 'C/C++ Header',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.less': 'Less',
  '.html': 'HTML',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.md': 'Markdown',
  '.sql': 'SQL',
  '.sh': 'Shell',
  '.bash': 'Bash',
  '.ps1': 'PowerShell',
  '.dart': 'Dart',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.hs': 'Haskell',
  '.scala': 'Scala',
  '.clj': 'Clojure',
  '.lua': 'Lua',
  '.r': 'R',
  '.vim': 'Vim',
  '.toml': 'TOML',
};

/**
 * 工具配置文件映射
 */
const TOOL_CONFIG_FILES: Array<{ name: string; type: DetectedTool['type']; version?: string }> = [
  { name: 'package.json', type: 'bundler' },
  { name: 'pnpm-workspace.yaml', type: 'bundler' },
  { name: 'yarn.lock', type: 'bundler' },
  { name: 'pnpm-lock.yaml', type: 'bundler' },
  { name: 'package-lock.json', type: 'bundler' },
  { name: 'Makefile', type: 'build' },
  { name: 'CMakeLists.txt', type: 'build' },
  { name: 'Dockerfile', type: 'deploy' },
  { name: 'docker-compose.yml', type: 'deploy' },
  { name: 'docker-compose.yaml', type: 'deploy' },
  { name: '.github/workflows', type: 'ci' },
  { name: '.gitlab-ci.yml', type: 'ci' },
  { name: 'Jenkinsfile', type: 'ci' },
  { name: '.eslintrc', type: 'linter' },
  { name: '.eslintrc.js', type: 'linter' },
  { name: '.eslintrc.json', type: 'linter' },
  { name: '.eslintrc.yaml', type: 'linter' },
  { name: '.eslintrc.yml', type: 'linter' },
  { name: '.prettierrc', type: 'formatter' },
  { name: '.prettierrc.js', type: 'formatter' },
  { name: '.prettierrc.json', type: 'formatter' },
  { name: 'pytest.ini', type: 'test' },
  { name: 'setup.py', type: 'bundler' },
  { name: 'pyproject.toml', type: 'bundler' },
  { name: 'requirements.txt', type: 'bundler' },
  { name: 'Cargo.toml', type: 'bundler' },
  { name: 'go.mod', type: 'bundler' },
  { name: 'Gemfile', type: 'bundler' },
  { name: 'composer.json', type: 'bundler' },
];

/**
 * Native 框架檢測實現
 */
export class NativeFrameworkDetection implements FrameworkDetectionCapability {
  readonly capabilityId = 'framework-detection' as const;
  readonly capabilityName = 'Framework Detection';
  readonly source = 'native' as const;
  readonly supportedModes = ['native', 'hybrid', 'auto'] as const;

  private config: NativeFrameworkDetectionConfig;
  private rules: FrameworkRule[];
  private cache: Map<string, { result: DetectionResult; timestamp: number }> = new Map();

  constructor(config: NativeFrameworkDetectionConfig = {}) {
    this.config = {
      enableCache: true,
      cacheTtl: 300, // 5 分鐘
      ...config,
    };
    
    this.rules = [...BUILTIN_FRAMEWORK_RULES, ...(config.customRules || [])];
  }

  async initialize(): Promise<void> {
    // Native 實現無需特殊初始化
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      latency: 0,
      message: 'Native framework detection is always available',
      timestamp: new Date(),
    };
  }

  async shutdown(): Promise<void> {
    this.cache.clear();
  }

  /**
   * 檢測專案框架
   */
  async detect(options: DetectionOptions): Promise<DetectionResult> {
    const startTime = Date.now();
    const { projectPath, deepAnalysis = false, maxFiles = 1000 } = options;

    // 檢查快取
    if (this.config.enableCache) {
      const cached = this.cache.get(projectPath);
      if (cached && Date.now() - cached.timestamp < (this.config.cacheTtl || 300) * 1000) {
        return cached.result;
      }
    }

    // 收集專案資訊
    const files = await this.collectFiles(projectPath, maxFiles);
    const packageJson = await this.readPackageJson(projectPath);
    const languages = this.detectLanguages(files);
    const frameworks = this.detectFrameworks(files, packageJson);
    const tools = this.detectTools(projectPath, files, packageJson);
    const structure = await this.analyzeStructure(projectPath, files);

    const result: DetectionResult = {
      frameworks,
      languages,
      tools,
      structure,
      totalFiles: files.length,
      duration: Date.now() - startTime,
      provider: 'native',
    };

    // 存入快取
    if (this.config.enableCache) {
      this.cache.set(projectPath, { result, timestamp: Date.now() });
    }

    return result;
  }

  /**
   * 快速檢測
   */
  async quickDetect(projectPath: string): Promise<DetectedFramework[]> {
    const packageJson = await this.readPackageJson(projectPath);
    const files = await this.collectFiles(projectPath, 50);
    return this.detectFrameworks(files, packageJson);
  }

  /**
   * 收集專案文件
   */
  private async collectFiles(rootPath: string, maxFiles: number): Promise<string[]> {
    const files: string[] = [];
    const excludeDirs = new Set([
      'node_modules', '.git', 'dist', 'build', 'out', '__pycache__',
      '.next', '.nuxt', 'vendor', 'target', 'venv', '.venv', 'env',
    ]);

    const walk = async (dir: string): Promise<void> => {
      if (files.length >= maxFiles) return;

      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (files.length >= maxFiles) break;
          
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            if (!excludeDirs.has(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath);
            }
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        // 忽略無法讀取的目錄
      }
    };

    await walk(rootPath);
    return files;
  }

  /**
   * 讀取 package.json
   */
  private async readPackageJson(projectPath: string): Promise<Record<string, unknown> | null> {
    try {
      const filePath = path.join(projectPath, 'package.json');
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * 檢測語言
   */
  private detectLanguages(files: string[]): DetectedLanguage[] {
    const languageCounts: Record<string, { count: number; extensions: Set<string> }> = {};

    for (const file of files) {
      const ext = path.extname(file);
      const language = EXTENSION_TO_LANGUAGE[ext];
      
      if (language) {
        if (!languageCounts[language]) {
          languageCounts[language] = { count: 0, extensions: new Set() };
        }
        languageCounts[language].count++;
        languageCounts[language].extensions.add(ext);
      }
    }

    const totalFiles = files.length || 1;
    const languages: DetectedLanguage[] = Object.entries(languageCounts)
      .map(([name, data]) => ({
        name,
        percentage: Math.round((data.count / totalFiles) * 100),
        fileCount: data.count,
      }))
      .sort((a, b) => b.fileCount - a.fileCount);

    return languages;
  }

  /**
   * 檢測框架
   */
  private detectFrameworks(files: string[], packageJson: Record<string, unknown> | null): DetectedFramework[] {
    const detected: DetectedFramework[] = [];
    const fileNames = new Set(files.map(f => path.basename(f)));
    const filePaths = new Set(files.map(f => f.replace(/\\/g, '/')));
    const dependencies = new Set([
      ...Object.keys((packageJson?.dependencies as Record<string, string>) || {}),
      ...Object.keys((packageJson?.devDependencies as Record<string, string>) || {}),
    ]);

    for (const rule of this.rules) {
      const evidence: DetectedFramework['evidence'] = [];
      let confidence = 0;

      // 檢查識別文件
      const foundFiles = rule.identifyFiles.filter(f => fileNames.has(f) || filePaths.has(f));
      if (foundFiles.length > 0) {
        confidence += 0.5;
        foundFiles.forEach(f => evidence.push({ type: 'file', description: `Found ${f}` }));
      }

      // 檢查依賴
      if (rule.identifyDependencies) {
        const foundDeps = rule.identifyDependencies.filter(d => dependencies.has(d));
        if (foundDeps.length > 0) {
          confidence += 0.4;
          foundDeps.forEach(d => evidence.push({ type: 'dependency', description: `Found dependency: ${d}` }));
        }
      }

      // 檢查模式
      if (rule.identifyPatterns && rule.identifyPatterns.length > 0) {
        const patternMatches = this.checkPatterns(files, rule.identifyPatterns);
        if (patternMatches > 0) {
          confidence += Math.min(0.3, patternMatches * 0.1);
          evidence.push({ type: 'pattern', description: `Found ${patternMatches} pattern match(es)` });
        }
      }

      if (confidence >= 0.3) {
        detected.push({
          name: rule.name,
          type: rule.type,
          confidence: Math.min(1, confidence),
          evidence,
        });
      }
    }

    return detected.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * 檢查模式匹配
   */
  private checkPatterns(files: string[], patterns: string[]): number {
    let matches = 0;
    const regexes = patterns.map(p => new RegExp(p, 'g'));

    for (const file of files.slice(0, 100)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        for (const regex of regexes) {
          if (regex.test(content)) {
            matches++;
          }
        }
      } catch {
        // 忽略無法讀取的文件
      }
    }

    return matches;
  }

  /**
   * 檢測工具
   */
  private detectTools(
    projectPath: string,
    files: string[],
    packageJson: Record<string, unknown> | null
  ): DetectedTool[] {
    const tools: DetectedTool[] = [];
    const fileNames = new Set(files.map(f => path.basename(f)));
    const filePaths = new Set(files.map(f => f.replace(/\\/g, '/')));

    for (const tool of TOOL_CONFIG_FILES) {
      if (fileNames.has(tool.name) || filePaths.some(f => f.includes(tool.name))) {
        tools.push({
          name: tool.name,
          type: tool.type,
          configPath: path.join(projectPath, tool.name),
        });
      }
    }

    // 從 package.json 提取工具
    if (packageJson) {
      const deps = {
        ...(packageJson.dependencies as Record<string, string>),
        ...(packageJson.devDependencies as Record<string, string>),
      };

      const toolDeps: Array<{ name: string; type: DetectedTool['type'] }> = [
        { name: 'typescript', type: 'build' },
        { name: 'esbuild', type: 'bundler' },
        { name: 'rollup', type: 'bundler' },
        { name: 'jest', type: 'test' },
        { name: 'vitest', type: 'test' },
        { name: 'mocha', type: 'test' },
        { name: 'eslint', type: 'linter' },
        { name: 'prettier', type: 'formatter' },
      ];

      for (const { name, type } of toolDeps) {
        if (deps[name]) {
          tools.push({
            name,
            type,
            version: deps[name],
          });
        }
      }
    }

    return tools;
  }

  /**
   * 分析專案結構
   */
  private async analyzeStructure(projectPath: string, files: string[]): Promise<ProjectStructure> {
    const dirSet = new Set<string>();
    let hasTests = false;
    let hasDocumentation = false;
    let hasCI = false;

    for (const file of files) {
      const relative = path.relative(projectPath, file);
      const parts = relative.split(/[/\\]/);
      
      if (parts.length > 1) {
        dirSet.add(parts[0]);
      }

      const fileName = path.basename(file).toLowerCase();
      if (fileName.includes('test') || fileName.includes('spec')) {
        hasTests = true;
      }
      if (fileName.endsWith('.md') || fileName === 'readme') {
        hasDocumentation = true;
      }
      if (relative.includes('.github/workflows') || relative.includes('.gitlab-ci')) {
        hasCI = true;
      }
    }

    const directories = Array.from(dirSet).map(d => ({
      path: d,
      fileCount: files.filter(f => f.startsWith(path.join(projectPath, d))).length,
    }));

    // 判斷專案類型
    let type: ProjectStructure['type'] = 'single-package';
    if (directories.some(d => d.path === 'packages' || d.path === 'apps')) {
      type = 'monorepo';
    } else if (directories.some(d => d.path === 'services' || d.path === 'apps')) {
      type = 'microservice';
    } else if (directories.some(d => d.path === 'src' || d.path === 'lib')) {
      type = 'library';
    }

    // 尋找入口點
    const entryPoints: string[] = [];
    const entryFileNames = ['index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js'];
    for (const file of files) {
      if (entryFileNames.includes(path.basename(file))) {
        entryPoints.push(path.relative(projectPath, file));
      }
    }

    return {
      type,
      entryPoints,
      directories: directories.slice(0, 10),
      hasTests,
      hasDocumentation,
      hasCI,
    };
  }
}

// 導出工廠函數
export function createNativeFrameworkDetection(config?: NativeFrameworkDetectionConfig): FrameworkDetectionCapability {
  return new NativeFrameworkDetection(config);
}