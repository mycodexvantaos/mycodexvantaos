/**
 * Runtime Configuration
 * 
 * 環境變數驅動的運行時配置系統
 * 實現 .env.local (native) / .env.docker (hybrid) / .env.prod (connected) 模式切換
 */

import { RuntimeMode } from './base';
import { ProviderFactoryConfig } from './provider-factory';

/**
 * 環境變數名稱
 */
export const ENV_VARS = {
  /**
   * 運行時模式
   */
  RUNTIME_MODE: 'MYCODEXVANTAOS_RUNTIME_MODE',

  /**
   * 是否啟用降級
   */
  FALLBACK_ENABLED: 'MYCODEXVANTAOS_FALLBACK_ENABLED',

  /**
   * 日誌級別
   */
  LOG_LEVEL: 'MYCODEXVANTAOS_LOG_LEVEL',

  /**
   * API 金鑰（External Provider 使用）
   */
  ANTHROPIC_API_KEY: 'ANTHROPIC_API_KEY',
  OPENAI_API_KEY: 'OPENAI_API_KEY',
  GOOGLE_API_KEY: 'GOOGLE_API_KEY',

  /**
   * 數據庫配置
   */
  DATABASE_URL: 'DATABASE_URL',

  /**
   * 存儲配置
   */
  STORAGE_TYPE: 'MYCODEXVANTAOS_STORAGE_TYPE',
  STORAGE_PATH: 'MYCODEXVANTAOS_STORAGE_PATH',

  /**
   * 認證配置
   */
  AUTH_JWT_SECRET: 'MYCODEXVANTAOS_AUTH_JWT_SECRET',
  AUTH_PROVIDER: 'MYCODEXVANTAOS_AUTH_PROVIDER',

  /**
   * 指標配置
   */
  METRICS_ENABLED: 'MYCODEXVANTAOS_METRICS_ENABLED',
  METRICS_PUSH_URL: 'MYCODEXVANTAOS_METRICS_PUSH_URL',
} as const;

/**
 * 運行時配置
 */
export interface RuntimeConfig {
  /**
   * 運行時模式
   */
  mode: RuntimeMode;

  /**
   * 是否啟用降級
   */
  fallbackEnabled: boolean;

  /**
   * 日誌級別
   */
  logLevel: 'debug' | 'info' | 'warn' | 'error';

  /**
   * 環境名稱
   */
  environment: 'local' | 'docker' | 'production' | 'test';

  /**
   * 是否為開發模式
   */
  isDevelopment: boolean;

  /**
   * 是否為生產模式
   */
  isProduction: boolean;

  /**
   * API 金鑰
   */
  apiKeys: {
    anthropic?: string;
    openai?: string;
    google?: string;
  };

  /**
   * 存儲配置
   */
  storage: {
    type: 'memory' | 'file' | 'indexeddb' | 'sqlite' | 's3';
    path?: string;
  };

  /**
   * Provider Factory 配置
   */
  providerFactory: ProviderFactoryConfig;
}

/**
 * 從環境變數讀取運行時配置
 */
export function getRuntimeConfig(): RuntimeConfig {
  // 讀取運行時模式
  const mode = parseRuntimeMode(process.env[ENV_VARS.RUNTIME_MODE]);

  // 讀取環境
  const environment = detectEnvironment();

  // 讀取 API 金鑰
  const apiKeys = {
    anthropic: process.env[ENV_VARS.ANTHROPIC_API_KEY],
    openai: process.env[ENV_VARS.OPENAI_API_KEY],
    google: process.env[ENV_VARS.GOOGLE_API_KEY],
  };

  // 根據環境和模式確定配置
  const config: RuntimeConfig = {
    mode,
    fallbackEnabled: parseBoolean(process.env[ENV_VARS.FALLBACK_ENABLED], true),
    logLevel: parseLogLevel(process.env[ENV_VARS.LOG_LEVEL]),
    environment,
    isDevelopment: environment === 'local' || environment === 'docker',
    isProduction: environment === 'production',
    apiKeys,
    storage: {
      type: parseStorageType(process.env[ENV_VARS.STORAGE_TYPE], mode),
      path: process.env[ENV_VARS.STORAGE_PATH],
    },
    providerFactory: buildProviderFactoryConfig(mode, apiKeys),
  };

  return config;
}

/**
 * 解析運行時模式
 */
function parseRuntimeMode(value?: string): RuntimeMode {
  switch (value?.toLowerCase()) {
    case 'native':
      return 'native';
    case 'connected':
      return 'connected';
    case 'hybrid':
      return 'hybrid';
    case 'auto':
      return 'auto';
    default:
      // 根據環境自動檢測
      return 'auto';
  }
}

/**
 * 檢測環境
 */
function detectEnvironment(): 'local' | 'docker' | 'production' | 'test' {
  // 檢查是否在 Docker 中
  if (process.env.DOCKER || process.env.KUBERNETES_SERVICE_HOST) {
    return 'docker';
  }

  // 檢查是否為生產環境
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }

  // 檢查是否為測試環境
  if (process.env.NODE_ENV === 'test' || process.env.VITEST || process.env.JEST_WORKER_ID) {
    return 'test';
  }

  // 默認為本地環境
  return 'local';
}

/**
 * 解析布爾值
 */
function parseBoolean(value?: string, defaultValue: boolean = false): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * 解析日誌級別
 */
function parseLogLevel(value?: string): 'debug' | 'info' | 'warn' | 'error' {
  switch (value?.toLowerCase()) {
    case 'debug':
      return 'debug';
    case 'info':
      return 'info';
    case 'warn':
      return 'warn';
    case 'error':
      return 'error';
    default:
      return 'info';
  }
}

/**
 * 解析存儲類型
 */
function parseStorageType(
  value?: string,
  mode?: RuntimeMode
): 'memory' | 'file' | 'indexeddb' | 'sqlite' | 's3' {
  switch (value?.toLowerCase()) {
    case 'memory':
      return 'memory';
    case 'file':
      return 'file';
    case 'indexeddb':
      return 'indexeddb';
    case 'sqlite':
      return 'sqlite';
    case 's3':
      return 's3';
    default:
      // 根據模式選擇默認值
      if (mode === 'native') {
        return 'memory';
      }
      return 'memory';
  }
}

/**
 * 構建 Provider Factory 配置
 */
function buildProviderFactoryConfig(
  mode: RuntimeMode,
  apiKeys: { anthropic?: string; openai?: string; google?: string }
): ProviderFactoryConfig {
  const config: ProviderFactoryConfig = {
    runtimeMode: mode,
    fallbackEnabled: true,
    native: {},
    external: {},
  };

  // 根據模式和 API 金鑰可用性調整配置
  if (mode === 'native') {
    // Native 模式：僅使用本地實現
    config.fallbackEnabled = false;
  } else if (mode === 'connected') {
    // Connected 模式：僅使用外部服務
    if (!apiKeys.anthropic && !apiKeys.openai && !apiKeys.google) {
      console.warn(
        'Connected mode requires API keys. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY.'
      );
    }
  } else if (mode === 'hybrid' || mode === 'auto') {
    // Hybrid/Auto 模式：優先外部，可降級到本地
    config.fallbackEnabled = true;
  }

  return config;
}

/**
 * 環境配置文件名稱
 */
export const ENV_FILES = {
  local: '.env.local',
  docker: '.env.docker',
  production: '.env.prod',
  test: '.env.test',
} as const;

/**
 * 獲取當前環境的配置文件名
 */
export function getEnvFileName(): string {
  const config = getRuntimeConfig();
  return ENV_FILES[config.environment];
}

/**
 * 驗證配置
 */
export function validateConfig(config: RuntimeConfig): string[] {
  const errors: string[] = [];

  // 驗證 Native 模式
  if (config.mode === 'native') {
    // Native 模式下，所有 Provider 應該是 native
    // 這是有效的，不需要額外驗證
  }

  // 驗證 Connected 模式
  if (config.mode === 'connected') {
    if (!config.apiKeys.anthropic && !config.apiKeys.openai && !config.apiKeys.google) {
      errors.push('Connected mode requires at least one API key to be set');
    }
  }

  // 驗證 Hybrid 模式
  if (config.mode === 'hybrid') {
    // Hybrid 模式需要確保有降級選項
    // 這是有效的，因為我們總是有 native 實現
  }

  return errors;
}

/**
 * 打印配置摘要（用於調試）
 */
export function printConfigSummary(config: RuntimeConfig): string {
  return `
Runtime Configuration:
  Mode: ${config.mode}
  Environment: ${config.environment}
  Fallback Enabled: ${config.fallbackEnabled}
  Log Level: ${config.logLevel}
  
API Keys:
  Anthropic: ${config.apiKeys.anthropic ? 'configured' : 'not set'}
  OpenAI: ${config.apiKeys.openai ? 'configured' : 'not set'}
  Google: ${config.apiKeys.google ? 'configured' : 'not set'}

Storage:
  Type: ${config.storage.type}
  Path: ${config.storage.path || 'default'}
`.trim();
}