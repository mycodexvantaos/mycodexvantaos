/**
 * 轉化示例：將 cross-framework/api-client.ts 轉化為使用 Provider 架構
 * 
 * 這個示例展示了如何將直接調用外部 API 的代碼轉化為使用統一的能力介面
 */

// ==================== 原始代碼（錯誤示範）====================
// ❌ 直接調用 Anthropic API，無法離線運行，無法降級

/*
// cross-framework/api-client.ts (原始版本)
export async function callClaudeAPI(
  apiKey: string,
  prompt: string,
  maxTokens: number = 1000
): Promise<string> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API Error: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as MessageResponse;
    return data.content?.[0]?.text || "{}";
  } catch (error) {
    console.error("Claude API Error:", error);
    throw error;
  }
}

// 使用方式
const result = await callClaudeAPI(apiKey, prompt);
*/

// ==================== 轉化後代碼（正確示範）====================
// ✅ 使用 Provider 架構，支持離線運行和降級

import {
  getProviderFactory,
  CodeSynthesisCapability,
  SynthesisOptions,
  SynthesisResult,
} from '@mycodexvantaos/capabilities';

/**
 * 轉化後的 API 客戶端
 * 
 * 使用 Provider Factory 獲取代碼合成能力
 * 根據運行時模式自動選擇 Native/External/Hybrid Provider
 */
export class CodeSynthesisClient {
  private provider: CodeSynthesisCapability | null = null;
  private initialized = false;

  /**
   * 初始化客戶端
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const factory = getProviderFactory();
    await factory.initialize();

    // 獲取代碼合成 Provider
    this.provider = await factory.getCodeSynthesisProvider();
    this.initialized = true;
  }

  /**
   * 調用代碼合成 API（轉化後版本）
   * 
   * @param prompt - 提示詞
   * @param options - 可選參數
   * @returns 合成結果
   */
  async callSynthesis(
    prompt: string,
    options?: {
      maxTokens?: number;
      context?: {
        language?: string;
        framework?: string;
      };
    }
  ): Promise<SynthesisResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.provider) {
      throw new Error('Code synthesis provider not initialized');
    }

    const synthesisOptions: SynthesisOptions = {
      prompt,
      context: options?.context,
      parameters: {
        maxTokens: options?.maxTokens,
      },
    };

    const result = await this.provider.generate(synthesisOptions);

    // 記錄降級情況
    if (result.fallbackTriggered) {
      console.warn('Code synthesis fell back to native provider');
    }

    return result;
  }

  /**
   * 分析代碼
   */
  async analyzeCode(
    code: string,
    analysisType: 'quality' | 'security' | 'performance' | 'architecture' = 'quality'
  ): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.provider || typeof this.provider.analyze !== 'function') {
      throw new Error('Code analysis not supported by current provider');
    }

    return await this.provider.analyze({ code, analysisType });
  }

  /**
   * 關閉客戶端
   */
  async shutdown(): Promise<void> {
    this.provider = null;
    this.initialized = false;
  }
}

// ==================== 使用示例 ====================

/**
 * 示例 1：基本使用
 */
async function example1() {
  const client = new CodeSynthesisClient();
  await client.initialize();

  try {
    const result = await client.callSynthesis('Create a React component');
    console.log('Generated code:', result.code);
    console.log('Provider:', result.provider);
    console.log('Confidence:', result.confidence);
  } finally {
    await client.shutdown();
  }
}

/**
 * 示例 2：帶上下文
 */
async function example2() {
  const client = new CodeSynthesisClient();
  await client.initialize();

  try {
    const result = await client.callSynthesis('Create a component', {
      context: {
        language: 'typescript',
        framework: 'react',
      },
      maxTokens: 2000,
    });
    console.log('Generated code:', result.code);
  } finally {
    await client.shutdown();
  }
}

/**
 * 示例 3：代碼分析
 */
async function example3() {
  const client = new CodeSynthesisClient();
  await client.initialize();

  try {
    const code = `
      function test() {
        console.log('test');
      }
    `;
    const analysis = await client.analyzeCode(code, 'quality');
    console.log('Analysis:', analysis);
  } finally {
    await client.shutdown();
  }
}

/**
 * 示例 4：錯誤處理
 */
async function example4() {
  const client = new CodeSynthesisClient();
  await client.initialize();

  try {
    const result = await client.callSynthesis('Create a component');
    
    if (result.fallbackTriggered) {
      console.warn('Using native provider (external API unavailable)');
    }

    if (result.confidence < 0.5) {
      console.warn('Low confidence result, consider manual review');
    }

    console.log('Generated code:', result.code);
  } catch (error) {
    console.error('Code synthesis failed:', error);
    // 錯誤處理邏輯
  } finally {
    await client.shutdown();
  }
}

// ==================== 運行時模式配置 ====================

/**
 * 根據環境變數自動選擇 Provider
 * 
 * .env.native: 使用 Native Provider（離線）
 * .env.hybrid: 使用 Hybrid Provider（優先外部，可降級）
 * .env.connected: 使用 External Provider（僅外部）
 */
export async function createClient(): Promise<CodeSynthesisClient> {
  const client = new CodeSynthesisClient();
  await client.initialize();
  return client;
}

// ==================== 向後兼容的包裝函數 ====================

/**
 * 向後兼容的包裝函數
 * 
 * 保持原有 API 簽名，內部使用新架構
 * 
 * @deprecated 建議使用 CodeSynthesisClient 類
 */
export async function callClaudeAPI(
  apiKey: string,
  prompt: string,
  maxTokens: number = 1000
): Promise<string> {
  const client = new CodeSynthesisClient();
  await client.initialize();

  try {
    const result = await client.callSynthesis(prompt, { maxTokens });
    return result.code;
  } finally {
    await client.shutdown();
  }
}

// ==================== 測試輔助函數 ====================

/**
 * 測試 Native 模式
 */
export async function testNativeMode() {
  // 設置環境變數
  process.env.MYCODEXVANTAOS_RUNTIME_MODE = 'native';

  const client = new CodeSynthesisClient();
  await client.initialize();

  try {
    const result = await client.callSynthesis('Create a React component');
    console.log('Native mode result:', result);
    console.assert(result.provider === 'native', 'Should use native provider');
  } finally {
    await client.shutdown();
  }
}

/**
 * 測試 Hybrid 模式
 */
export async function testHybridMode() {
  // 設置環境變數
  process.env.MYCODEXVANTAOS_RUNTIME_MODE = 'hybrid';
  process.env.ANTHROPIC_API_KEY = 'test-key';

  const client = new CodeSynthesisClient();
  await client.initialize();

  try {
    const result = await client.callSynthesis('Create a React component');
    console.log('Hybrid mode result:', result);
    // 在 Hybrid 模式下，如果 API 不可用，應該降級到 native
  } finally {
    await client.shutdown();
  }
}

/**
 * 測試 Connected 模式
 */
export async function testConnectedMode() {
  // 設置環境變數
  process.env.MYCODEXVANTAOS_RUNTIME_MODE = 'connected';
  process.env.ANTHROPIC_API_KEY = 'test-key';

  const client = new CodeSynthesisClient();
  await client.initialize();

  try {
    const result = await client.callSynthesis('Create a React component');
    console.log('Connected mode result:', result);
    console.assert(result.provider !== 'native', 'Should not use native provider');
  } finally {
    await client.shutdown();
  }
}

// 導出所有示例和測試函數
export {
  example1,
  example2,
  example3,
  example4,
  testNativeMode,
  testHybridMode,
  testConnectedMode,
};