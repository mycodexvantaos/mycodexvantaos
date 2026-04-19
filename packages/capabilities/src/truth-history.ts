/**
 * Truth History Capability Interface
 * 
 * 真相歷史能力 - 用於記錄、追蹤、查詢系統狀態變化歷史
 * 
 * 平台獨立性要求：
 * - Native 實現：IndexedDB（瀏覽器） / SQLite（Node.js）
 * - External 實現：PostgreSQL / MongoDB / 時序數據庫
 * - Hybrid 實現：本地緩存，定期同步到雲端
 */

import { CapabilityBase, HealthCheckResult } from './base';

/**
 * 歷史記錄條目
 */
export interface HistoryEntry<T = unknown> {
  /**
   * 條目 ID
   */
  id: string;

  /**
   * 時間戳
   */
  timestamp: Date;

  /**
   * 事件類型
   */
  eventType: string;

  /**
   * 實體類型
   */
  entityType: string;

  /**
   * 實體 ID
   */
  entityId: string;

  /**
   * 變更前數據
   */
  before?: T;

  /**
   * 變更後數據
   */
  after?: T;

  /**
   * 變更差異
   */
  diff?: Record<string, { old: unknown; new: unknown }>;

  /**
   * 操作者
   */
  actor?: {
    type: 'user' | 'system' | 'service';
    id?: string;
    name?: string;
  };

  /**
   * 元數據
   */
  metadata?: Record<string, unknown>;
}

/**
 * 查詢選項
 */
export interface HistoryQueryOptions {
  /**
   * 實體類型過濾
   */
  entityType?: string;

  /**
   * 實體 ID 過濾
   */
  entityId?: string;

  /**
   * 事件類型過濾
   */
  eventType?: string;

  /**
   * 時間範圍開始
   */
  startTime?: Date;

  /**
   * 時間範圍結束
   */
  endTime?: Date;

  /**
   * 操作者過濾
   */
  actorId?: string;

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
export interface HistoryQueryResult<T = unknown> {
  /**
   * 記錄列表
   */
  entries: HistoryEntry<T>[];

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
 * 聚合選項
 */
export interface AggregationOptions {
  /**
   * 聚合類型
   */
  type: 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';

  /**
   * 分組字段
   */
  groupBy?: string[];

  /**
   * 時間間隔
   */
  interval?: 'minute' | 'hour' | 'day' | 'week' | 'month';

  /**
   * 過濾條件
   */
  filter?: HistoryQueryOptions;
}

/**
 * 聚合結果
 */
export interface AggregationResult {
  /**
   * 聚合值
   */
  value: number;

  /**
   * 分組數據
   */
  groups?: Array<{
    key: string;
    value: number;
    count?: number;
  }>;
}

/**
 * 快照資訊
 */
export interface SnapshotInfo {
  /**
   * 快照 ID
   */
  id: string;

  /**
   * 創建時間
   */
  createdAt: Date;

  /**
   * 描述
   */
  description?: string;

  /**
   * 標籤
   */
  tags?: string[];

  /**
   * 大小（字節）
   */
  size?: number;
}

/**
 * 真相歷史能力介面
 */
export interface TruthHistoryCapability extends CapabilityBase {
  /**
   * 能力標識
   */
  readonly capabilityId: 'truth-history';

  /**
   * 記錄事件
   */
  record<T = unknown>(entry: Omit<HistoryEntry<T>, 'id' | 'timestamp'>): Promise<HistoryEntry<T>>;

  /**
   * 查詢歷史
   */
  query<T = unknown>(options: HistoryQueryOptions): Promise<HistoryQueryResult<T>>;

  /**
   * 獲取單條記錄
   */
  get<T = unknown>(id: string): Promise<HistoryEntry<T> | null>;

  /**
   * 聚合查詢
   */
  aggregate(options: AggregationOptions): Promise<AggregationResult>;

  /**
   * 創建快照
   */
  createSnapshot?(description?: string, tags?: string[]): Promise<SnapshotInfo>;

  /**
   * 恢復快照
   */
  restoreSnapshot?(snapshotId: string): Promise<void>;

  /**
   * 列出快照
   */
  listSnapshots?(): Promise<SnapshotInfo[]>;

  /**
   * 刪除快照
   */
  deleteSnapshot?(snapshotId: string): Promise<void>;

  /**
   * 清理舊記錄
   */
  purge?(olderThan: Date): Promise<number>;

  /**
   * 導出數據
   */
  export?(options?: HistoryQueryOptions): Promise<string>;

  /**
   * 導入數據
   */
  import?(data: string): Promise<number>;
}

/**
 * Native 真相歷史配置
 */
export interface NativeTruthHistoryConfig {
  /**
   * 存儲類型
   */
  storageType: 'indexeddb' | 'sqlite' | 'file';

  /**
   * 數據庫名稱
   */
  dbName?: string;

  /**
   * 數據庫路徑（SQLite/File）
   */
  dbPath?: string;

  /**
   * 最大記錄數
   */
  maxRecords?: number;

  /**
   * 自動清理間隔（秒）
   */
  autoPurgeInterval?: number;

  /**
   * 記錄保留天數
   */
  retentionDays?: number;
}

/**
 * External 真相歷史配置
 */
export interface ExternalTruthHistoryConfig {
  /**
   * 數據庫類型
   */
  dbType: 'postgres' | 'mongodb' | 'timescaledb' | 'influxdb';

  /**
   * 連接字符串
   */
  connectionString?: string;

  /**
   * 主機
   */
  host?: string;

  /**
   * 端口
   */
  port?: number;

  /**
   * 數據庫名
   */
  database?: string;

  /**
   * 用戶名
   */
  username?: string;

  /**
   * 密碼
   */
  password?: string;
}