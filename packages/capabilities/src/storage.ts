/**
 * Storage Capability Interface
 * 
 * 存儲能力 - 用於文件、對象、數據的持久化存儲
 * 
 * 平台獨立性要求：
 * - Native 實現：本地文件系統 / IndexedDB / SQLite
 * - External 實現：S3 / GCS / Azure Blob
 * - Hybrid 實現：優先本地，可同步到雲端
 */

import { CapabilityBase, HealthCheckResult } from './base';

/**
 * 存儲選項
 */
export interface StorageOptions {
  /**
   * 是否覆蓋已存在的文件
   */
  overwrite?: boolean;

  /**
   * 元數據
   */
  metadata?: Record<string, string>;

  /**
   * 內容類型
   */
  contentType?: string;

  /**
   * 緩存控制
   */
  cacheControl?: string;
}

/**
 * 文件資訊
 */
export interface FileInfo {
  /**
   * 文件路徑/鍵
   */
  key: string;

  /**
   * 文件大小（字節）
   */
  size: number;

  /**
   * 最後修改時間
   */
  lastModified: Date;

  /**
   * 內容類型
   */
  contentType?: string;

  /**
   * 元數據
   */
  metadata?: Record<string, string>;

  /**
   * ETag
   */
  etag?: string;
}

/**
 * 列表選項
 */
export interface ListOptions {
  /**
   * 前綴過濾
   */
  prefix?: string;

  /**
   * 最大返回數量
   */
  maxResults?: number;

  /**
   * 分頁標記
   */
  continuationToken?: string;
}

/**
 * 列表結果
 */
export interface ListResult {
  /**
   * 文件列表
   */
  files: FileInfo[];

  /**
   * 是否還有更多
   */
  hasMore: boolean;

  /**
   * 下一頁標記
   */
  continuationToken?: string;
}

/**
 * 存儲能力介面
 */
export interface StorageCapability extends CapabilityBase {
  /**
   * 能力標識
   */
  readonly capabilityId: 'storage';

  /**
   * 存儲文件
   */
  put(key: string, data: Buffer | string | Uint8Array, options?: StorageOptions): Promise<void>;

  /**
   * 獲取文件
   */
  get(key: string): Promise<Buffer>;

  /**
   * 刪除文件
   */
  delete(key: string): Promise<void>;

  /**
   * 檢查文件是否存在
   */
  exists(key: string): Promise<boolean>;

  /**
   * 獲取文件資訊
   */
  getFileInfo(key: string): Promise<FileInfo>;

  /**
   * 列出文件
   */
  list(options?: ListOptions): Promise<ListResult>;

  /**
   * 複製文件
   */
  copy(sourceKey: string, destKey: string, options?: StorageOptions): Promise<void>;

  /**
   * 移動文件
   */
  move(sourceKey: string, destKey: string, options?: StorageOptions): Promise<void>;

  /**
   * 獲取臨時 URL（用於下載）
   */
  getSignedUrl?(key: string, expiresIn?: number): Promise<string>;

  /**
   * 批量操作
   */
  batch?(operations: Array<{
    type: 'put' | 'delete' | 'copy' | 'move';
    key: string;
    destKey?: string;
    data?: Buffer | string;
    options?: StorageOptions;
  }>): Promise<void>;
}

/**
 * Native 存儲配置
 */
export interface NativeStorageConfig {
  /**
   * 基礎路徑
   */
  basePath?: string;

  /**
   * 是否使用索引
   */
  enableIndexing?: boolean;

  /**
   * 最大文件大小（字節）
   */
  maxFileSize?: number;
}

/**
 * External 存儲配置
 */
export interface ExternalStorageConfig {
  /**
   * 服務端點
   */
  endpoint?: string;

  /**
   * Bucket 名稱
   */
  bucket: string;

  /**
   * 訪問金鑰
   */
  accessKeyId?: string;

  /**
   * 密鑰
   */
  secretAccessKey?: string;

  /**
   * 區域
   */
  region?: string;
}