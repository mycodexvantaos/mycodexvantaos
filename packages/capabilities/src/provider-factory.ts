/**
 * Provider Factory
 * 
 * 根據運行時模式和配置創建適當的 Provider 實例
 * 實現服務定位器模式
 */

import {
  CapabilityBase,
  RuntimeMode,
  ProviderResolutionOptions,
  ProviderResolutionResult,
  HealthCheckResult,
} from './base';

import {
  CodeSynthesisCapability,
  FrameworkDetectionCapability,
  TruthHistoryCapability,
} from './index';

import {
  createNativeCodeSynthesis,
  NativeCodeSynthesisConfig,
} from '../../providers/native/src/code-synthesis';

import {
  createNativeFrameworkDetection,
  NativeFrameworkDetectionConfig,
} from '../../providers/native/src/framework-detection';

import {
  createNativeTruthHistory,
  NativeTruthHistoryConfig,
} from '../../providers/native/src/truth-history';

/**
 * Provider 註冊資訊
 */
interface ProviderRegistration<T extends CapabilityBase> {
  capability: string;
  provider: T;
  source: 'native' | 'external' | 'hybrid';
  priority: number;
  initialized: boolean;
}

/**
 * Provider Factory 配置
 */
export interface ProviderFactoryConfig {
  /**
   * 運行時模式
   */
  runtimeMode?: RuntimeMode;

  /**
   * 是否啟用降級
   */
  fallbackEnabled?: boolean;

  /**
   * Native 配置
   */
  native?: {
    codeSynthesis?: NativeCodeSynthesisConfig;
    frameworkDetection?: NativeFrameworkDetectionConfig;
    truthHistory?: NativeTruthHistoryConfig;
  };

  /**
   * External 配置
   */
  external?: {
    // TODO: 添加外部 Provider 配置
  };
}

/**
 * Provider Factory
 * 
 * 負責創建和管理所有 Provider 實例
 */
export class ProviderFactory {
  private config: Required<ProviderFactoryConfig>;
  private providers: Map<string, ProviderRegistration<CapabilityBase>> = new Map();
  private initialized = false;

  constructor(config: ProviderFactoryConfig = {}) {
    this.config = {
      runtimeMode: config.runtimeMode || 'auto',
      fallbackEnabled: config.fallbackEnabled !== false,
      native: config.native || {},
      external: config.external || {},
    };
  }

  /**
   * 初始化 Factory
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 根據運行時模式註冊 Provider
    await this.registerProviders();

    // 初始化所有已註冊的 Provider
    for (const registration of this.providers.values()) {
      if (!registration.initialized) {
        await registration.provider.initialize();
        registration.initialized = true;
      }
    }

    this.initialized = true;
  }

  /**
   * 解析 Provider
   */
  async resolve<T extends CapabilityBase>(
    options: ProviderResolutionOptions
  ): Promise<ProviderResolutionResult<T>> {
    const { capability, runtimeMode, preferredProvider, fallbackEnabled } = options;

    const mode = runtimeMode || this.config.runtimeMode;
    const enableFallback = fallbackEnabled !== undefined ? fallbackEnabled : this.config.fallbackEnabled;

    // 獲取該能力的所有 Provider
    const providers = this.getProvidersForCapability(capability, mode);

    if (providers.length === 0) {
      throw new Error(`No providers available for capability: ${capability}`);
    }

    // 如果指定了首選 Provider
    if (preferredProvider) {
      const preferred = providers.find(p => p.provider.capabilityId === preferredProvider);
      if (preferred) {
        const health = await preferred.provider.healthCheck();
        if (health.status === 'healthy') {
          return {
            provider: preferred.provider as T,
            capability,
            runtimeMode: mode,
            timestamp: new Date(),
            fallbackUsed: false,
          };
        }
      }
    }

    // 選擇健康的 Provider
    for (const registration of providers) {
      const health = await registration.provider.healthCheck();
      if (health.status === 'healthy') {
        return {
          provider: registration.provider as T,
          capability,
          runtimeMode: mode,
          timestamp: new Date(),
          fallbackUsed: false,
        };
      }
    }

    // 如果啟用降級，嘗試使用任何可用的 Provider
    if (enableFallback && providers.length > 0) {
      return {
        provider: providers[0].provider as T,
        capability,
        runtimeMode: mode,
        timestamp: new Date(),
        fallbackUsed: true,
        metadata: {
          message: 'Using degraded provider',
        },
      };
    }

    throw new Error(`No healthy providers available for capability: ${capability}`);
  }

  /**
   * 獲取代碼合成 Provider
   */
  async getCodeSynthesisProvider(): Promise<CodeSynthesisCapability> {
    const result = await this.resolve<CodeSynthesisCapability>({
      capability: 'code-synthesis',
    });
    return result.provider;
  }

  /**
   * 獲取框架檢測 Provider
   */
  async getFrameworkDetectionProvider(): Promise<FrameworkDetectionCapability> {
    const result = await this.resolve<FrameworkDetectionCapability>({
      capability: 'framework-detection',
    });
    return result.provider;
  }

  /**
   * 獲取真相歷史 Provider
   */
  async getTruthHistoryProvider(): Promise<TruthHistoryCapability> {
    const result = await this.resolve<TruthHistoryCapability>({
      capability: 'truth-history',
    });
    return result.provider;
  }

  /**
   * 註冊 Provider
   */
  registerProvider<T extends CapabilityBase>(
    capability: string,
    provider: T,
    source: 'native' | 'external' | 'hybrid',
    priority: number = 0
  ): void {
    const key = `${capability}:${source}`;
    this.providers.set(key, {
      capability,
      provider,
      source,
      priority,
      initialized: false,
    });
  }

  /**
   * 執行健康檢查
   */
  async performHealthChecks(): Promise<Map<string, HealthCheckResult>> {
    const results = new Map<string, HealthCheckResult>();

    for (const [key, registration] of this.providers) {
      try {
        const health = await registration.provider.healthCheck();
        results.set(key, health);
      } catch (error) {
        results.set(key, {
          status: 'unhealthy',
          timestamp: new Date(),
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return results;
  }

  /**
   * 獲取統計資訊
   */
  getStatistics(): {
    totalProviders: number;
    initializedProviders: number;
    providersByCapability: Record<string, number>;
    providersBySource: Record<string, number>;
  } {
    const stats = {
      totalProviders: this.providers.size,
      initializedProviders: 0,
      providersByCapability: {} as Record<string, number>,
      providersBySource: {} as Record<string, number>,
    };

    for (const registration of this.providers.values()) {
      if (registration.initialized) {
        stats.initializedProviders++;
      }

      stats.providersByCapability[registration.capability] =
        (stats.providersByCapability[registration.capability] || 0) + 1;

      stats.providersBySource[registration.source] =
        (stats.providersBySource[registration.source] || 0) + 1;
    }

    return stats;
  }

  /**
   * 關閉所有 Provider
   */
  async shutdown(): Promise<void> {
    for (const registration of this.providers.values()) {
      if (registration.initialized) {
        await registration.provider.shutdown();
      }
    }
    this.providers.clear();
    this.initialized = false;
  }

  // ==================== 私有方法 ====================

  /**
   * 根據運行時模式註冊 Provider
   */
  private async registerProviders(): Promise<void> {
    const mode = this.config.runtimeMode;

    // 代碼合成 Provider
    if (mode === 'native' || mode === 'auto' || mode === 'hybrid') {
      this.registerProvider(
        'code-synthesis',
        createNativeCodeSynthesis(this.config.native.codeSynthesis),
        'native',
        100
      );
    }

    // 框架檢測 Provider
    if (mode === 'native' || mode === 'auto' || mode === 'hybrid') {
      this.registerProvider(
        'framework-detection',
        createNativeFrameworkDetection(this.config.native.frameworkDetection),
        'native',
        100
      );
    }

    // 真相歷史 Provider
    if (mode === 'native' || mode === 'auto' || mode === 'hybrid') {
      this.registerProvider(
        'truth-history',
        createNativeTruthHistory(this.config.native.truthHistory),
        'native',
        100
      );
    }

    // TODO: 根據模式註冊 External 和 Hybrid Provider
  }

  /**
   * 獲取指定能力的 Provider 列表
   */
  private getProvidersForCapability(
    capability: string,
    mode: RuntimeMode
  ): ProviderRegistration<CapabilityBase>[] {
    const providers: ProviderRegistration<CapabilityBase>[] = [];

    for (const registration of this.providers.values()) {
      if (registration.capability !== capability) continue;

      // 檢查 Provider 是否支持該模式
      const supportsMode = registration.provider.supportedModes.includes(mode);
      if (!supportsMode) continue;

      providers.push(registration);
    }

    // 按優先級排序
    providers.sort((a, b) => b.priority - a.priority);

    return providers;
  }
}

/**
 * 單例實例
 */
let factoryInstance: ProviderFactory | null = null;

/**
 * 獲取 Provider Factory 單例
 */
export function getProviderFactory(config?: ProviderFactoryConfig): ProviderFactory {
  if (!factoryInstance) {
    factoryInstance = new ProviderFactory(config);
  }
  return factoryInstance;
}

/**
 * 重置 Provider Factory（主要用於測試）
 */
export function resetProviderFactory(): void {
  if (factoryInstance) {
    factoryInstance.shutdown();
    factoryInstance = null;
  }
}