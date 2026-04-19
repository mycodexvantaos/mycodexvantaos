/**
 * MyCodexVantaOS Capability Base Interface
 * 
 * 所有能力介面的基礎定義，確保平台獨立性原則：
 * - 可獨立
 * - 可分離
 * - 可組合
 * - 可抽離
 * - 可移植
 * - 可離線
 * - 可遷移
 */

/**
 * 能力來源類型
 * - native: 零外部依賴，本地實現
 * - external: 第三方服務/API
 * - hybrid: 帶降級策略的混合實現
 */
export type CapabilitySource = 'native' | 'external' | 'hybrid';

/**
 * 運行時模式
 * - native: 僅使用本地實現，可離線運行
 * - connected: 僅使用外部服務，需要網路連接
 * - hybrid: 優先外部，可降級到本地
 * - auto: 根據環境自動選擇
 */
export type RuntimeMode = 'native' | 'connected' | 'hybrid' | 'auto';

/**
 * 健康檢查結果
 */
export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  message?: string;
  timestamp: Date;
  details?: Record<string, unknown>;
}

/**
 * 能力基礎介面
 * 
 * 所有能力必須實現此介面，確保統一的行為契約
 */
export interface CapabilityBase {
  /**
   * 能力標識符（唯一）
   */
  readonly capabilityId: string;

  /**
   * 能力名稱（人類可讀）
   */
  readonly capabilityName: string;

  /**
   * 能力來源
   */
  readonly source: CapabilitySource;

  /**
   * 支持的運行時模式
   */
  readonly supportedModes: RuntimeMode[];

  /**
   * 初始化能力
   * 在使用前必須調用
   */
  initialize(): Promise<void>;

  /**
   * 健康檢查
   * 用於判斷能力是否可用
   */
  healthCheck(): Promise<HealthCheckResult>;

  /**
   * 優雅關閉
   * 釋放資源，清理狀態
   */
  shutdown(): Promise<void>;
}

/**
 * Provider 配置基礎介面
 */
export interface ProviderConfig {
  /**
   * Provider 唯一標識
   */
  providerId: string;

  /**
   * Provider 類型
   */
  providerType: string;

  /**
   * 運行時模式
   */
  runtimeMode: RuntimeMode;

  /**
   * 是否啟用降級
   */
  fallbackEnabled?: boolean;

  /**
   * 優先級（數字越小優先級越高）
   */
  priority?: number;

  /**
   * 自定義配置
   */
  options?: Record<string, unknown>;
}

/**
 * Provider 解析選項
 */
export interface ProviderResolutionOptions {
  capability: string;
  runtimeMode?: RuntimeMode;
  preferredProvider?: string;
  fallbackEnabled?: boolean;
  context?: {
    serviceName?: string;
    environment?: string;
    tenantId?: string;
  };
}

/**
 * Provider 解析結果
 */
export interface ProviderResolutionResult<T extends CapabilityBase> {
  provider: T;
  capability: string;
  runtimeMode: RuntimeMode;
  timestamp: Date;
  fallbackUsed: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * 降級策略
 */
export interface FallbackStrategy {
  /**
   * 是否啟用降級
   */
  enabled: boolean;

  /**
   * 降級觸發條件
   */
  triggers: FallbackTrigger[];

  /**
   * 降級目標 Provider
   */
  fallbackProvider?: string;

  /**
   * 降級後的行為
   */
  onFallback?: () => void;
}

/**
 * 降級觸發條件
 */
export interface FallbackTrigger {
  type: 'error' | 'timeout' | 'unhealthy' | 'rate-limited' | 'custom';
  threshold?: number;
  condition?: (error: Error) => boolean;
}

/**
 * 能力註冊資訊
 */
export interface CapabilityRegistration {
  capabilityId: string;
  providerId: string;
  source: CapabilitySource;
  supportedModes: RuntimeMode[];
  priority: number;
  registeredAt: Date;
  config: ProviderConfig;
}