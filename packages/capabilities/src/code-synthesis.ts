/**
 * Code Synthesis Capability Interface
 * 
 * 代碼合成能力 - 用於 AI 輔助代碼生成、分析、重構
 * 
 * 平台獨立性要求：
 * - Native 實現：基於模板匹配 + AST 變換，無需外部 API
 * - External 實現：調用 Claude/OpenAI 等 AI 服務
 * - Hybrid 實現：優先外部 API，失敗時降級到本地模板
 */

import { CapabilityBase, CapabilitySource, RuntimeMode, HealthCheckResult } from './base';

/**
 * 合成選項
 */
export interface SynthesisOptions {
  /**
   * 輸入提示詞
   */
  prompt: string;

  /**
   * 語言/框架上下文
   */
  context?: {
    language?: string;
    framework?: string;
    fileContext?: string;
    projectType?: string;
  };

  /**
   * 生成參數
   */
  parameters?: {
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  };

  /**
   * 額外的系統提示
   */
  systemPrompt?: string;

  /**
   * 歷史對話（用於多輪對話）
   */
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

/**
 * 合成結果
 */
export interface SynthesisResult {
  /**
   * 生成的代碼
   */
  code: string;

  /**
   * 信心度 (0-1)
   */
  confidence: number;

  /**
   * 使用的 Provider
   */
  provider: string;

  /**
   * 是否觸發降級
   */
  fallbackTriggered?: boolean;

  /**
   * 生成時間（毫秒）
   */
  duration?: number;

  /**
   * Token 使用量
   */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };

  /**
   * 額外元數據
   */
  metadata?: Record<string, unknown>;
}

/**
 * 分析選項
 */
export interface AnalysisOptions {
  /**
   * 要分析的代碼
   */
  code: string;

  /**
   * 分析類型
   */
  analysisType: 'quality' | 'security' | 'performance' | 'architecture' | 'custom';

  /**
   * 自定義分析規則
   */
  customRules?: string[];
}

/**
 * 分析結果
 */
export interface AnalysisResult {
  /**
   * 分析摘要
   */
  summary: string;

  /**
   * 發現的問題
   */
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    column?: number;
    ruleId?: string;
  }>;

  /**
   * 建議
   */
  suggestions: Array<{
    description: string;
    priority: 'high' | 'medium' | 'low';
  }>;

  /**
   * 使用的 Provider
   */
  provider: string;

  /**
   * 信心度
   */
  confidence: number;
}

/**
 * 代碼合成能力介面
 */
export interface CodeSynthesisCapability extends CapabilityBase {
  /**
   * 能力標識
   */
  readonly capabilityId: 'code-synthesis';

  /**
   * 生成代碼
   */
  generate(options: SynthesisOptions): Promise<SynthesisResult>;

  /**
   * 分析代碼
   */
  analyze?(options: AnalysisOptions): Promise<AnalysisResult>;

  /**
   * 重構代碼
   */
  refactor?(code: string, instructions: string): Promise<SynthesisResult>;

  /**
   * 解釋代碼
   */
  explain?(code: string): Promise<string>;
}

/**
 * Native 代碼合成實現的配置
 */
export interface NativeSynthesisConfig {
  /**
   * 模板庫路徑
   */
  templatePath?: string;

  /**
   * 是否啟用 AST 解析
   */
  enableAstParsing?: boolean;

  /**
   * 預設模板
   */
  builtinTemplates?: boolean;
}

/**
 * External 代碼合成實現的配置
 */
export interface ExternalSynthesisConfig {
  /**
   * API 端點
   */
  endpoint?: string;

  /**
   * API 金鑰（從 Secrets Provider 獲取）
   */
  apiKeySecretRef?: string;

  /**
   * 模型名稱
   */
  model?: string;

  /**
   * 超時時間（毫秒）
   */
  timeout?: number;

  /**
   * 最大重試次數
   */
  maxRetries?: number;
}

/**
 * Hybrid 代碼合成實現的配置
 */
export interface HybridSynthesisConfig {
  /**
   * 外部 Provider 配置
   */
  external: ExternalSynthesisConfig;

  /**
   * 本地 Provider 配置
   */
  native: NativeSynthesisConfig;

  /**
   * 降級策略
   */
  fallbackStrategy: {
    enabled: boolean;
    maxRetries: number;
    timeout: number;
  };
}