/**
 * Metrics Capability Interface
 * 
 * 指標能力 - 用於收集、聚合、查詢系統指標
 * 
 * 平台獨立性要求：
 * - Native 實現：內存存儲 / 本地文件
 * - External 實現：Prometheus / Datadog / CloudWatch
 * - Hybrid 實現：本地緩存，定期推送
 */

import { CapabilityBase, HealthCheckResult } from './base';

/**
 * 指標類型
 */
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

/**
 * 指標標籤
 */
export type MetricLabels = Record<string, string | number | boolean>;

/**
 * 指標數據
 */
export interface MetricData {
  /**
   * 指標名稱
   */
  name: string;

  /**
   * 指標類型
   */
  type: MetricType;

  /**
   * 值
   */
  value: number;

  /**
   * 標籤
   */
  labels?: MetricLabels;

  /**
   * 時間戳
   */
  timestamp: Date;
}

/**
 * 計數器選項
 */
export interface CounterOptions {
  /**
   * 指標名稱
   */
  name: string;

  /**
   * 描述
   */
  help?: string;

  /**
   * 標籤名稱
   */
  labelNames?: string[];
}

/**
 * 儀表選項
 */
export interface GaugeOptions {
  /**
   * 指標名稱
   */
  name: string;

  /**
   * 描述
   */
  help?: string;

  /**
   * 標籤名稱
   */
  labelNames?: string[];
}

/**
 * 直方圖選項
 */
export interface HistogramOptions {
  /**
   * 指標名稱
   */
  name: string;

  /**
   * 描述
   */
  help?: string;

  /**
   * 標籤名稱
   */
  labelNames?: string[];

  /**
   * 桶邊界
   */
  buckets?: number[];
}

/**
 * 查詢選項
 */
export interface MetricsQueryOptions {
  /**
   * 指標名稱過濾
   */
  namePattern?: string;

  /**
   * 標籤過濾
   */
  labels?: MetricLabels;

  /**
   * 時間範圍開始
   */
  startTime?: Date;

  /**
   * 時間範圍結束
   */
  endTime?: Date;

  /**
   * 聚合函數
   */
  aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';

  /**
   * 分組標籤
   */
  groupBy?: string[];
}

/**
 * 查詢結果
 */
export interface MetricsQueryResult {
  /**
   * 指標數據列表
   */
  metrics: MetricData[];

  /**
   * 總數
   */
  total: number;
}

/**
 * 指標能力介面
 */
export interface MetricsCapability extends CapabilityBase {
  /**
   * 能力標識
   */
  readonly capabilityId: 'metrics';

  /**
   * 創建計數器
   */
  createCounter(options: CounterOptions): void;

  /**
   * 增加計數器
   */
  increment(name: string, value?: number, labels?: MetricLabels): void;

  /**
   * 創建儀表
   */
  createGauge(options: GaugeOptions): void;

  /**
   * 設置儀表值
   */
  set(name: string, value: number, labels?: MetricLabels): void;

  /**
   * 增加儀表值
   */
  gaugeIncrement(name: string, value?: number, labels?: MetricLabels): void;

  /**
   * 減少儀表值
   */
  gaugeDecrement(name: string, value?: number, labels?: MetricLabels): void;

  /**
   * 創建直方圖
   */
  createHistogram(options: HistogramOptions): void;

  /**
   * 記錄直方圖觀察值
   */
  observe(name: string, value: number, labels?: MetricLabels): void;

  /**
   * 記錄計時
   */
  timing(name: string, duration: number, labels?: MetricLabels): void;

  /**
   * 查詢指標
   */
  query(options: MetricsQueryOptions): Promise<MetricsQueryResult>;

  /**
   * 獲取所有指標
   */
  getAll(): Promise<MetricData[]>;

  /**
   * 清除指標
   */
  clear(name?: string): void;

  /**
   * 導出指標（Prometheus 格式）
   */
  exportPrometheus?(): Promise<string>;

  /**
   * 導出指標（JSON 格式）
   */
  exportJson?(): Promise<string>;
}

/**
 * Native 指標配置
 */
export interface NativeMetricsConfig {
  /**
   * 最大指標數量
   */
  maxMetrics?: number;

  /**
   * 每個指標最大標籤數量
   */
  maxLabelsPerMetric?: number;

  /**
   * 是否持久化到文件
   */
  persistToFile?: boolean;

  /**
   * 持久化路徑
   */
  persistPath?: string;

  /**
   * 持久化間隔（秒）
   */
  persistInterval?: number;
}

/**
 * External 指標配置
 */
export interface ExternalMetricsConfig {
  /**
   * 推送端點
   */
  pushGatewayUrl?: string;

  /**
   * 推送間隔（秒）
   */
  pushInterval?: number;

  /**
   * 批次大小
   */
  batchSize?: number;

  /**
   * 是否啟用拉取端點
   */
  enablePullEndpoint?: boolean;

  /**
   * 拉取端口
   */
  pullPort?: number;
}