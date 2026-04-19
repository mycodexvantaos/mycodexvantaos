/**
 * Auth Capability Interface
 * 
 * 認證能力 - 用於身份驗證、授權、會話管理
 * 
 * 平台獨立性要求：
 * - Native 實現：JWT 本地驗證 / 內存會話存儲
 * - External 實現：OAuth / OIDC / Auth0 / Clerk
 * - Hybrid 實現：本地驗證，可同步到外部
 */

import { CapabilityBase, HealthCheckResult } from './base';

/**
 * 用戶資訊
 */
export interface UserInfo {
  /**
   * 用戶 ID
   */
  id: string;

  /**
   * 用戶名
   */
  username?: string;

  /**
   * 郵箱
   */
  email?: string;

  /**
   * 顯示名稱
   */
  displayName?: string;

  /**
   * 頭像
   */
  avatar?: string;

  /**
   * 角色
   */
  roles?: string[];

  /**
   * 權限
   */
  permissions?: string[];

  /**
   * 元數據
   */
  metadata?: Record<string, unknown>;
}

/**
 * 認證結果
 */
export interface AuthResult {
  /**
   * 是否成功
   */
  success: boolean;

  /**
   * 訪問令牌
   */
  accessToken?: string;

  /**
   * 刷新令牌
   */
  refreshToken?: string;

  /**
   * 過期時間
   */
  expiresAt?: Date;

  /**
   * 用戶資訊
   */
  user?: UserInfo;

  /**
   * 錯誤訊息
   */
  error?: string;
}

/**
 * 令牌驗證結果
 */
export interface TokenVerificationResult {
  /**
   * 是否有效
   */
  valid: boolean;

  /**
   * 用戶資訊
   */
  user?: UserInfo;

  /**
   * 過期時間
   */
  expiresAt?: Date;

  /**
   * 錯誤訊息
   */
  error?: string;
}

/**
 * 會話資訊
 */
export interface SessionInfo {
  /**
   * 會話 ID
   */
  id: string;

  /**
   * 用戶 ID
   */
  userId: string;

  /**
   * 創建時間
   */
  createdAt: Date;

  /**
   * 最後活動時間
   */
  lastActivityAt: Date;

  /**
   * 過期時間
   */
  expiresAt: Date;

  /**
   * 設備資訊
   */
  device?: {
    name?: string;
    type?: string;
    ip?: string;
  };
}

/**
 * 登入選項
 */
export interface LoginOptions {
  /**
   * 記住我
   */
  rememberMe?: boolean;

  /**
   * 設備資訊
   */
  device?: {
    name?: string;
    type?: string;
  };

  /**
   * 重定向 URL
   */
  redirectUrl?: string;
}

/**
 * 認證能力介面
 */
export interface AuthCapability extends CapabilityBase {
  /**
   * 能力標識
   */
  readonly capabilityId: 'auth';

  /**
   * 登入
   */
  login(credentials: { username?: string; email?: string; password: string }, options?: LoginOptions): Promise<AuthResult>;

  /**
   * 登出
   */
  logout(sessionId?: string): Promise<void>;

  /**
   * 驗證令牌
   */
  verifyToken(token: string): Promise<TokenVerificationResult>;

  /**
   * 刷新令牌
   */
  refreshToken(refreshToken: string): Promise<AuthResult>;

  /**
   * 獲取當前用戶
   */
  getCurrentUser(): Promise<UserInfo | null>;

  /**
   * 檢查權限
   */
  hasPermission(permission: string): Promise<boolean>;

  /**
   * 檢查角色
   */
  hasRole(role: string): Promise<boolean>;

  /**
   * 獲取會話列表
   */
  getSessions?(): Promise<SessionInfo[]>;

  /**
   * 撤銷會話
   */
  revokeSession?(sessionId: string): Promise<void>;
}

/**
 * Native 認證配置
 */
export interface NativeAuthConfig {
  /**
   * JWT 密鑰
   */
  jwtSecret: string;

  /**
   * 令牌過期時間（秒）
   */
  tokenExpiry?: number;

  /**
   * 刷新令牌過期時間（秒）
   */
  refreshTokenExpiry?: number;

  /**
   * 用戶存儲（內存或文件）
   */
  userStorage?: 'memory' | 'file';

  /**
   * 用戶數據文件路徑
   */
  userFilePath?: string;
}

/**
 * External 認證配置
 */
export interface ExternalAuthConfig {
  /**
   * 提供者類型
   */
  provider: 'oauth2' | 'oidc' | 'auth0' | 'clerk' | 'custom';

  /**
   * 客戶端 ID
   */
  clientId: string;

  /**
   * 客戶端密鑰
   */
  clientSecret?: string;

  /**
   * 授權端點
   */
  authorizationEndpoint?: string;

  /**
   * 令牌端點
   */
  tokenEndpoint?: string;

  /**
   * 用戶資訊端點
   */
  userInfoEndpoint?: string;

  /**
   * 回調 URL
   */
  callbackUrl?: string;

  /**
   * 範圍
   */
  scope?: string[];
}