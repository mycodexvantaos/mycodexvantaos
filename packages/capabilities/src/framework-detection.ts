/**
 * Framework Detection Capability Interface
 * 
 * 框架檢測能力 - 用於識別專案使用的框架、語言、工具
 * 
 * 平台獨立性要求：
 * - Native 實現：使用 tree-sitter / 正則 / package.json 解析，完全本地
 * - External 實現：調用 AI 服務進行分析
 * - Hybrid 實現：優先本地，複雜情況可請求 AI
 */

import { CapabilityBase, HealthCheckResult } from './base';

/**
 * 檢測選項
 */
export interface DetectionOptions {
  /**
   * 專案根目錄路徑
   */
  projectPath: string;

  /**
   * 是否深入分析
   */
  deepAnalysis?: boolean;

  /**
   * 檢測範圍
   */
  scope?: ('dependencies' | 'structure' | 'code' | 'config')[];

  /**
   * 排除模式
   */
  excludePatterns?: string[];

  /**
   * 最大文件數量
   */
  maxFiles?: number;
}

/**
 * 檢測到的框架資訊
 */
export interface DetectedFramework {
  /**
   * 框架名稱
   */
  name: string;

  /**
   * 框架類型
   */
  type: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'cli' | 'library';

  /**
   * 版本（如果可確定）
   */
  version?: string;

  /**
   * 信心度 (0-1)
   */
  confidence: number;

  /**
   * 檢測依據
   */
  evidence: Array<{
    type: 'file' | 'dependency' | 'pattern' | 'config';
    description: string;
    path?: string;
  }>;
}

/**
 * 檢測到的語言
 */
export interface DetectedLanguage {
  /**
   * 語言名稱
   */
  name: string;

  /**
   * 版本
   */
  version?: string;

  /**
   * 使用比例
   */
  percentage: number;

  /**
   * 文件數量
   */
  fileCount: number;
}

/**
 * 檢測到的工具
 */
export interface DetectedTool {
  /**
   * 工具名稱
   */
  name: string;

  /**
   * 工具類型
   */
  type: 'bundler' | 'build' | 'test' | 'linter' | 'formatter' | 'ci' | 'deploy' | 'other';

  /**
   * 版本
   */
  version?: string;

  /**
   * 配置文件路徑
   */
  configPath?: string;
}

/**
 * 專案結構分析
 */
export interface ProjectStructure {
  /**
   * 專案類型
   */
  type: 'monorepo' | 'single-package' | 'microservice' | 'library' | 'unknown';

  /**
   * 入口點
   */
  entryPoints: string[];

  /**
   * 主要目錄
   */
  directories: Array<{
    path: string;
    purpose?: string;
    fileCount: number;
  }>;

  /**
   * 是否有測試
   */
  hasTests: boolean;

  /**
   * 是否有文檔
   */
  hasDocumentation: boolean;

  /**
   * 是否有 CI/CD
   */
  hasCI: boolean;
}

/**
 * 檢測結果
 */
export interface DetectionResult {
  /**
   * 檢測到的框架
   */
  frameworks: DetectedFramework[];

  /**
   * 檢測到的語言
   */
  languages: DetectedLanguage[];

  /**
   * 檢測到的工具
   */
  tools: DetectedTool[];

  /**
   * 專案結構
   */
  structure: ProjectStructure;

  /**
   * 總文件數
   */
  totalFiles: number;

  /**
   * 分析時間（毫秒）
   */
  duration: number;

  /**
   * 使用的 Provider
   */
  provider: string;

  /**
   * 是否觸發降級
   */
  fallbackTriggered?: boolean;
}

/**
 * 框架檢測能力介面
 */
export interface FrameworkDetectionCapability extends CapabilityBase {
  /**
   * 能力標識
   */
  readonly capabilityId: 'framework-detection';

  /**
   * 檢測專案框架
   */
  detect(options: DetectionOptions): Promise<DetectionResult>;

  /**
   * 快速檢測（僅檢查關鍵文件）
   */
  quickDetect?(projectPath: string): Promise<DetectedFramework[]>;

  /**
   * 獲取建議的配置
   */
  suggestConfig?(framework: string): Promise<Record<string, unknown>>;
}

/**
 * Native 框架檢測配置
 */
export interface NativeDetectionConfig {
  /**
   * 預設框架規則
   */
  frameworkRules?: FrameworkRule[];

  /**
   * 是否使用 AST 解析
   */
  useAstParsing?: boolean;

  /**
   * 快取結果
   */
  enableCache?: boolean;

  /**
   * 快取過期時間（秒）
   */
  cacheTtl?: number;
}

/**
 * 框架檢測規則
 */
export interface FrameworkRule {
  /**
   * 框架名稱
   */
  name: string;

  /**
   * 識別文件
   */
  identifyFiles: string[];

  /**
   * 識別依賴
   */
  identifyDependencies?: string[];

  /**
   * 識別模式（正則）
   */
  identifyPatterns?: string[];

  /**
   * 類型
   */
  type: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'desktop' | 'cli' | 'library';
}

/**
 * 內建框架規則
 */
export const BUILTIN_FRAMEWORK_RULES: FrameworkRule[] = [
  // Frontend Frameworks
  {
    name: 'react',
    identifyFiles: ['react.config.js', 'react.config.ts'],
    identifyDependencies: ['react', 'react-dom'],
    identifyPatterns: ['import.*from\\s*[\'"]react[\'"]', 'React\\.Component'],
    type: 'frontend'
  },
  {
    name: 'vue',
    identifyFiles: ['vue.config.js', 'vue.config.ts'],
    identifyDependencies: ['vue'],
    identifyPatterns: ['import.*from\\s*[\'"]vue[\'"]', 'createApp\\('],
    type: 'frontend'
  },
  {
    name: 'angular',
    identifyFiles: ['angular.json'],
    identifyDependencies: ['@angular/core'],
    identifyPatterns: ['@Component\\(', '@NgModule\\('],
    type: 'frontend'
  },
  {
    name: 'svelte',
    identifyFiles: ['svelte.config.js'],
    identifyDependencies: ['svelte'],
    identifyPatterns: ['\\.svelte'],
    type: 'frontend'
  },
  {
    name: 'next.js',
    identifyFiles: ['next.config.js', 'next.config.mjs'],
    identifyDependencies: ['next'],
    identifyPatterns: ['from\\s*[\'"]next[\'"]'],
    type: 'fullstack'
  },
  {
    name: 'nuxt',
    identifyFiles: ['nuxt.config.ts', 'nuxt.config.js'],
    identifyDependencies: ['nuxt'],
    type: 'fullstack'
  },
  // Backend Frameworks
  {
    name: 'express',
    identifyFiles: [],
    identifyDependencies: ['express'],
    identifyPatterns: ['express\\(\\)', 'app\\.use\\('],
    type: 'backend'
  },
  {
    name: 'fastify',
    identifyFiles: [],
    identifyDependencies: ['fastify'],
    identifyPatterns: ['fastify\\(\\)', 'app\\.register\\('],
    type: 'backend'
  },
  {
    name: 'nestjs',
    identifyFiles: ['nest-cli.json'],
    identifyDependencies: ['@nestjs/core'],
    identifyPatterns: ['@Controller\\(', '@Module\\('],
    type: 'backend'
  },
  {
    name: 'django',
    identifyFiles: ['settings.py', 'urls.py'],
    identifyDependencies: ['django'],
    identifyPatterns: ['from\\s+django', 'import\\s+django'],
    type: 'backend'
  },
  {
    name: 'flask',
    identifyFiles: [],
    identifyDependencies: ['flask'],
    identifyPatterns: ['Flask\\(__name__\\)'],
    type: 'backend'
  },
  {
    name: 'fastapi',
    identifyFiles: [],
    identifyDependencies: ['fastapi'],
    identifyPatterns: ['FastAPI\\(\\)'],
    type: 'backend'
  },
  // Mobile Frameworks
  {
    name: 'react-native',
    identifyFiles: ['react-native.config.js'],
    identifyDependencies: ['react-native'],
    identifyPatterns: ['import.*from\\s*[\'"]react-native[\'"]'],
    type: 'mobile'
  },
  {
    name: 'expo',
    identifyFiles: ['app.json', 'app.config.ts', 'app.config.js'],
    identifyDependencies: ['expo'],
    type: 'mobile'
  },
  {
    name: 'flutter',
    identifyFiles: ['pubspec.yaml'],
    identifyDependencies: ['flutter'],
    identifyPatterns: ['package:flutter'],
    type: 'mobile'
  },
  // Build Tools
  {
    name: 'webpack',
    identifyFiles: ['webpack.config.js', 'webpack.config.ts'],
    identifyDependencies: ['webpack'],
    type: 'bundler'
  },
  {
    name: 'vite',
    identifyFiles: ['vite.config.ts', 'vite.config.js'],
    identifyDependencies: ['vite'],
    type: 'bundler'
  },
  {
    name: 'esbuild',
    identifyFiles: [],
    identifyDependencies: ['esbuild'],
    type: 'bundler'
  },
  // Test Frameworks
  {
    name: 'jest',
    identifyFiles: ['jest.config.js', 'jest.config.ts'],
    identifyDependencies: ['jest'],
    type: 'test'
  },
  {
    name: 'vitest',
    identifyFiles: ['vitest.config.ts', 'vitest.config.js'],
    identifyDependencies: ['vitest'],
    type: 'test'
  },
  {
    name: 'pytest',
    identifyFiles: ['pytest.ini', 'pyproject.toml'],
    identifyDependencies: ['pytest'],
    type: 'test'
  },
];