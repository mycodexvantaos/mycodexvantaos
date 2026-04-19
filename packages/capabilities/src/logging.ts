/**
 * Logging Capability Interface
 * 
 * 日誌能力 - 用於記錄、查詢、分析系統日誌
 * 
 * 平台獨立性要求：
 * - Native 實現：控制台 / 本地文件 / IndexedDB
 * - External 實現：ELK / CloudWatch / Datadog Logs
 * - Hybrid 實現：本地緩存，批量上傳
 */

import { CapabilityBase, HealthCheckResult } from './base';

/**
 * 日誌級別
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * 日誌條目
 */
export interface LogEntry {
  /**
   * 日誌級別
   */
  level: LogLevel;

  /**
   * 訊息
   */
  message: string;

  /**
   * 時間戳
   */
  timestamp: Date;

  /**
   * 上下文數據
   */
  context?: Record<string, unknown>;

  /**
   * 錯誤對象
   */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };

  /**
   * 標籤
   */
  tags?: string[];

  /**
   * 來源
   */
  source?: {
    file?: string;
    line?: number;
    function?: string;
  };

  /**
   * 關聯 ID（用於追蹤）
   */
  correlationId?: string;

  /**
   * 用戶 ID
   */
  userId?: string;

  /**
   * 會話 ID
   */
  sessionId?: string;
}

/**
 * 日誌選項
 */
export interface LogOptions {
  /**
   * 上下文數據
   */
  context?: Record<string, unknown>;

  /**
   * 標籤
   */
  tags?: string[];

  /**
   * 關聯 ID
   */
  correlationId?: string;

  /**
   * 用戶 ID
   */
  userId?: string;

  /**
   * 會話 ID
   */
  sessionId?: string;
}

/**
 * 查詢選項
 */
export interface LogQueryOptions {
  /**
   * 日誌級別過濾
   */
  level?: LogLevel | LogLevel[];

  /**
   * 訊息過濾（正則）
   */
  messagePattern?: string;

  /**
   * 標籤過濾
   */
  tags?: string[];

  /**
   * 上下文過濾
   */
  context?: Record<string, unknown>;

  /**
   * 時間範圍開始
   */
  startTime?: Date;

  /**
   * 時間範圍結束
   */
  endTime?: Date;

  /**
   * 關聯 ID 過濾
   */
  correlationId?: string;

  /**
   * 用戶 ID 過濾
   */
  userId?: string;

  /**
   * 最大返回數量
   */
  limit?: number;

  /**
   * 偏移量
   */
  offset?: number;

  /**
   * 排序方向
   */
  order?: 'asc' | 'desc';
}

/**
 * 查詢結果
 */
export interface LogQueryResult {
  /**
   * 日誌列表
   */
  entries: LogEntry[];

  /**
   * 總數
   */
  total: number;

  /**
   * 是否還有更多
   */
  hasMore: boolean;
}

/**
 * 日誌統計
 */
export interface LogStatistics {
  /**
   * 總日誌數
   */
  total: number;

  /**
   * 按級別分組
   */
  byLevel: Record<LogLevel, number>;

  /**
   * 按標籤分組
   */
  byTag: Record<string, number>;

  /**
   * 時間範圍
   */
  timeRange: {
    start: Date;
    end: Date;
  };
}

/**
 * 日誌能力介面
 */
export interface LoggingCapability extends CapabilityBase {
  /**
   * 能力標識
   */
  readonly capabilityId: 'logging';

  /**
   * 記錄調試日誌
   */
  debug(message: string, options?: LogOptions): void;

  /**
   * 記錄信息日誌
   */
  info(message: string, options?: LogOptions): void;

  /**
   * 記錄警告日誌
   */
  warn(message: string, options?: LogOptions): void;

  /**
   * 記錄錯誤日誌
   */
  error(message: string, error?: Error, options?: LogOptions): void;

  /**
   * 記錄致命錯誤日誌
   */
  fatal(message: string, error?: Error, options?: LogOptions): void;

  /**
   * 查詢日誌
   */
  query(options: LogQueryOptions): Promise<LogQueryResult>;

  /**
   * 獲取統計
   */
  getStatistics(options?: Omit<LogQueryOptions, 'limit' | 'offset' | 'order'>): Promise<LogStatistics>;

  /**
   * 清除日誌
   */
  clear(olderThan?: Date): Promise<number>;

  /**
   * 導出日誌
   */
  export?(options?: LogQueryOptions, format?: 'json' | 'text' | 'csv'): Promise<string>;

  /**
   * 創建子日誌記錄器
   */
  createChild?(context: Record<string, unknown>): LoggingCapability;

  /**
   * 設置日誌級別
   */
  setLevel?(level: LogLevel): void;
}

/**
 * Native 日誌配置
 */
export interface NativeLoggingConfig {
  /**
   * 最小日誌級別
   */
  minLevel?: LogLevel;

  /**
   * 輸出目標
   */
  outputs?: Array<'console' | 'file' | 'indexeddb'>;

  /**
   * 文件路徑
   */
  filePath?: string;

  /**
   * 最大文件大小（字節）
   */
  maxFileSize?: number;

  /**
   * 最大文件數量
   */
  maxFiles?: number;

  /**
   * 是否包含堆棧跟蹤
   */
  includeStackTrace?: boolean;

  /**
   * 是否格式化輸出
   */
  prettyPrint?: boolean;
}

/**
 * External 日誌配置
 */
export interface ExternalLoggingConfig {
  /**
   * 服務類型
   */
  service: 'elasticsearch' | 'cloudwatch' | 'datadog' | 'loggly' | 'custom';

  /**
   * 端點 URL
   */
  endpoint?: string;

  /**
   * API 金鑰
   */
  apiKey?: string;

  /**
   * 索引名稱（Elasticsearch）
   */
  indexName?: string;

  /**
   * 日誌組（CloudWatch）
   */
  logGroupName?: string;

  /**
   * 批次大小
   */
  batchSize?: number;

  /**
   * 刷新間隔（毫秒）
   */
  flushInterval?: number;

  /**
   * 重試次數
   */
  maxRetries?: number;
}