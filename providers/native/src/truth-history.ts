/**
 * Native Truth History Provider
 * 
 * 零外部依賴的歷史記錄實現
 * 支援 IndexedDB（瀏覽器）和 SQLite（Node.js）
 * 
 * 完全可離線運行
 */

import {
  TruthHistoryCapability,
  HistoryEntry,
  HistoryQueryOptions,
  HistoryQueryResult,
  AggregationOptions,
  AggregationResult,
  SnapshotInfo,
  HealthCheckResult,
} from '@mycodexvantaos/capabilities';

/**
 * 內存歷史存儲
 */
interface InMemoryHistoryStore {
  entries: Map<string, HistoryEntry>;
  snapshots: Map<string, { info: SnapshotInfo; entries: HistoryEntry[] }>;
}

/**
 * Native 真相歷史配置
 */
export interface NativeTruthHistoryConfig {
  /**
   * 存儲類型
   */
  storageType?: 'memory' | 'indexeddb' | 'sqlite';

  /**
   * 數據庫名稱
   */
  dbName?: string;

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
 * Native 真相歷史實現
 */
export class NativeTruthHistory implements TruthHistoryCapability {
  readonly capabilityId = 'truth-history' as const;
  readonly capabilityName = 'Truth History';
  readonly source = 'native' as const;
  readonly supportedModes = ['native', 'hybrid', 'auto'] as const;

  private config: Required<NativeTruthHistoryConfig>;
  private store: InMemoryHistoryStore;
  private initialized = false;
  private purgeTimer?: ReturnType<typeof setInterval>;

  constructor(config: NativeTruthHistoryConfig = {}) {
    this.config = {
      storageType: config.storageType || 'memory',
      dbName: config.dbName || 'mycodexvantaos-history',
      maxRecords: config.maxRecords || 10000,
      autoPurgeInterval: config.autoPurgeInterval || 3600,
      retentionDays: config.retentionDays || 30,
    };

    this.store = {
      entries: new Map(),
      snapshots: new Map(),
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 初始化存儲
    if (this.config.storageType === 'indexeddb') {
      await this.initIndexedDB();
    } else if (this.config.storageType === 'sqlite') {
      await this.initSQLite();
    }

    // 啟動自動清理
    if (this.config.autoPurgeInterval > 0) {
      this.purgeTimer = setInterval(
        () => this.runAutoPurge(),
        this.config.autoPurgeInterval * 1000
      );
    }

    this.initialized = true;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      latency: 0,
      message: `Native truth history is available (${this.store.entries.size} entries)`,
      timestamp: new Date(),
      details: {
        entriesCount: this.store.entries.size,
        snapshotsCount: this.store.snapshots.size,
        storageType: this.config.storageType,
      },
    };
  }

  async shutdown(): Promise<void> {
    if (this.purgeTimer) {
      clearInterval(this.purgeTimer);
    }
    this.store.entries.clear();
    this.store.snapshots.clear();
    this.initialized = false;
  }

  /**
   * 記錄事件
   */
  async record<T = unknown>(entry: Omit<HistoryEntry<T>, 'id' | 'timestamp'>): Promise<HistoryEntry<T>> {
    const newEntry: HistoryEntry<T> = {
      ...entry,
      id: this.generateId(),
      timestamp: new Date(),
    } as HistoryEntry<T>;

    // 檢查是否超過最大記錄數
    if (this.store.entries.size >= this.config.maxRecords) {
      await this.purgeOldest(1);
    }

    this.store.entries.set(newEntry.id, newEntry);
    
    // 持久化（如果啟用）
    await this.persistEntry(newEntry);

    return newEntry;
  }

  /**
   * 查詢歷史
   */
  async query<T = unknown>(options: HistoryQueryOptions): Promise<HistoryQueryResult<T>> {
    let entries = Array.from(this.store.entries.values()) as HistoryEntry<T>[];

    // 應用過濾條件
    if (options.entityType) {
      entries = entries.filter(e => e.entityType === options.entityType);
    }
    if (options.entityId) {
      entries = entries.filter(e => e.entityId === options.entityId);
    }
    if (options.eventType) {
      entries = entries.filter(e => e.eventType === options.eventType);
    }
    if (options.startTime) {
      entries = entries.filter(e => e.timestamp >= options.startTime!);
    }
    if (options.endTime) {
      entries = entries.filter(e => e.timestamp <= options.endTime!);
    }
    if (options.actorId) {
      entries = entries.filter(e => e.actor?.id === options.actorId);
    }

    // 排序
    const order = options.order || 'desc';
    entries.sort((a, b) => {
      const diff = a.timestamp.getTime() - b.timestamp.getTime();
      return order === 'desc' ? -diff : diff;
    });

    // 分頁
    const total = entries.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    entries = entries.slice(offset, offset + limit);

    return {
      entries,
      total,
      hasMore: offset + entries.length < total,
    };
  }

  /**
   * 獲取單條記錄
   */
  async get<T = unknown>(id: string): Promise<HistoryEntry<T> | null> {
    return (this.store.entries.get(id) as HistoryEntry<T>) || null;
  }

  /**
   * 聚合查詢
   */
  async aggregate(options: AggregationOptions): Promise<AggregationResult> {
    const { type, groupBy, filter } = options;

    // 獲取過濾後的數據
    let entries = Array.from(this.store.entries.values());
    
    if (filter) {
      if (filter.entityType) {
        entries = entries.filter(e => e.entityType === filter.entityType);
      }
      if (filter.startTime) {
        entries = entries.filter(e => e.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        entries = entries.filter(e => e.timestamp <= filter.endTime!);
      }
    }

    // 分組
    if (groupBy && groupBy.length > 0) {
      const groups: Record<string, number[]> = {};

      for (const entry of entries) {
        const key = groupBy.map(field => (entry as any)[field] || 'unknown').join(':');
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(1);
      }

      const groupResults = Object.entries(groups).map(([key, values]) => ({
        key,
        value: this.aggregateValues(values, type),
        count: values.length,
      }));

      return {
        value: this.aggregateValues(groupResults.map(g => g.value), type),
        groups: groupResults,
      };
    }

    return {
      value: this.aggregateValues(entries.map(() => 1), type),
    };
  }

  /**
   * 創建快照
   */
  async createSnapshot(description?: string, tags?: string[]): Promise<SnapshotInfo> {
    const id = this.generateId();
    const entries = Array.from(this.store.entries.values());

    const info: SnapshotInfo = {
      id,
      createdAt: new Date(),
      description,
      tags,
      size: JSON.stringify(entries).length,
    };

    this.store.snapshots.set(id, { info, entries });

    return info;
  }

  /**
   * 恢復快照
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = this.store.snapshots.get(snapshotId);
    if (!snapshot) {
      throw new Error(`Snapshot not found: ${snapshotId}`);
    }

    // 清空當前數據
    this.store.entries.clear();

    // 恢復快照數據
    for (const entry of snapshot.entries) {
      this.store.entries.set(entry.id, entry);
    }
  }

  /**
   * 列出快照
   */
  async listSnapshots(): Promise<SnapshotInfo[]> {
    return Array.from(this.store.snapshots.values())
      .map(s => s.info)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * 刪除快照
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    this.store.snapshots.delete(snapshotId);
  }

  /**
   * 清理舊記錄
   */
  async purge(olderThan: Date): Promise<number> {
    let count = 0;
    const toDelete: string[] = [];

    for (const [id, entry] of this.store.entries) {
      if (entry.timestamp < olderThan) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      this.store.entries.delete(id);
      count++;
    }

    return count;
  }

  /**
   * 導出數據
   */
  async export(options?: HistoryQueryOptions): Promise<string> {
    const result = await this.query(options);
    return JSON.stringify(result.entries, null, 2);
  }

  /**
   * 導入數據
   */
  async import(data: string): Promise<number> {
    const entries = JSON.parse(data) as HistoryEntry[];
    let count = 0;

    for (const entry of entries) {
      // 確保有 ID 和時間戳
      if (!entry.id) {
        entry.id = this.generateId();
      }
      if (!entry.timestamp) {
        entry.timestamp = new Date();
      } else if (typeof entry.timestamp === 'string') {
        entry.timestamp = new Date(entry.timestamp);
      }

      this.store.entries.set(entry.id, entry);
      count++;
    }

    return count;
  }

  // ==================== 私有方法 ====================

  /**
   * 生成唯一 ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 聚合值計算
   */
  private aggregateValues(values: number[], type: string): number {
    if (values.length === 0) return 0;

    switch (type) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'distinct':
        return new Set(values).size;
      default:
        return values.length;
    }
  }

  /**
   * 清理最舊記錄
   */
  private async purgeOldest(count: number): Promise<void> {
    const entries = Array.from(this.store.entries.values())
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    for (let i = 0; i < Math.min(count, entries.length); i++) {
      this.store.entries.delete(entries[i].id);
    }
  }

  /**
   * 自動清理
   */
  private async runAutoPurge(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.config.retentionDays);
    await this.purge(cutoff);
  }

  /**
   * 初始化 IndexedDB
   */
  private async initIndexedDB(): Promise<void> {
    // 瀏覽器環境下的 IndexedDB 初始化
    if (typeof window !== 'undefined' && window.indexedDB) {
      return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(this.config.dbName, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          // TODO: 從 IndexedDB 加載數據到內存
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('entries')) {
            db.createObjectStore('entries', { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains('snapshots')) {
            db.createObjectStore('snapshots', { keyPath: 'id' });
          }
        };
      });
    }
  }

  /**
   * 初始化 SQLite
   */
  private async initSQLite(): Promise<void> {
    // Node.js 環境下的 SQLite 初始化
    // 注意：這需要 better-sqlite3 或類似庫
    // 這裡僅作為佔位符，實際實現取決於運行環境
    try {
      // 動態導入 SQLite 庫
      // const Database = require('better-sqlite3');
      // const db = new Database(this.config.dbName + '.db');
      // db.exec(`CREATE TABLE IF NOT EXISTS entries ...`);
      // TODO: 從 SQLite 加載數據到內存
    } catch (error) {
      // SQLite 不可用，回退到內存存儲
      console.warn('SQLite not available, falling back to memory storage');
    }
  }

  /**
   * 持久化條目
   */
  private async persistEntry(entry: HistoryEntry): Promise<void> {
    // 根據存儲類型持久化
    if (this.config.storageType === 'indexeddb') {
      // TODO: IndexedDB 持久化
    } else if (this.config.storageType === 'sqlite') {
      // TODO: SQLite 持久化
    }
  }
}

// 導出工廠函數
export function createNativeTruthHistory(config?: NativeTruthHistoryConfig): TruthHistoryCapability {
  return new NativeTruthHistory(config);
}