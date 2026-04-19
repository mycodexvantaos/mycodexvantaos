# 需求規格說明書（RSD）- CodexvantaOS Workflows v2.0

**版本**：2.0.0  
**狀態**：定稿（架構轉型：Native-first / Provider-agnostic）  
**日期**：2024-03-13  
**所有者**：CodexvantaOS Platform Team  
**架構哲學**：「第三方服務是平台的擴充出口，不是平台成立的地基。」

---

## 1. 功能描述

### 1.1 核心使命

建立 CodexvantaOS 中央工作流樞紐（WorkflowHub），為包含 25 個微服務的分佈式自治系統提供 **Native-first / Provider-agnostic** 的完整平台能力。平台在零外部依賴的情況下即可完整運行，第三方服務僅作為可選的擴充出口。

核心能力包括：

- **統一的 CI/CD 編排能力**：跨 25 倉庫的分層、並行、可觀測工作流編排
- **Provider-agnostic 架構**：12 個抽象介面覆蓋所有平台能力，每個介面均有 Native 和 External 實作
- **三模式運行**：Native Mode（零依賴）、Connected Mode（全外部）、Hybrid Mode（混合）
- **運行時能力偵測**：ProviderRegistry 自動偵測可用服務並選擇最佳 Provider
- **零依賴啟動**：`git clone && npm start` 即可啟動完整平台
- **漸進式擴充**：按需接入外部服務，不影響已有功能

### 1.2 範疇邊界

**包含**：
- ✅ 25 倉庫跨庫編排（5 層 Tier、9 執行平面）
- ✅ 12 個 Provider 抽象介面定義與實作
- ✅ Native Provider 全套實作（零外部依賴）
- ✅ External Provider 範例實作（Supabase、Redis、GitHub）
- ✅ ProviderRegistry 運行時能力偵測與自動 failover
- ✅ Provider-agnostic 工作流（orchestrator.yml v2 + repository-runner.yml v2）
- ✅ 秘密和認證集中管理（Provider-agnostic）
- ✅ 可觀測性三大支柱（日誌、指標、追蹤）
- ✅ 安全掃描（內建 13 正則模式 + 外部擴充）
- ✅ 多平台代碼同步機制（Provider-agnostic）
- ✅ 多雲部署自動化（Provider-agnostic）
- ✅ 策略驅動的治理執行

**不包含**：
- ❌ 應用程式邏輯實現
- ❌ 業務規則引擎
- ❌ 數據持久化層管理（由各倉庫通過 DatabaseProvider 自行處理）
- ❌ 實時監控告警系統（由 observability-stack 通過 ObservabilityProvider 負責）

### 1.3 主要功能模組

| 模組 | 功能 | 優先級 | Provider 依賴 |
|------|------|--------|---------------|
| **Provider Registry** | 運行時能力偵測、自動初始化、failover | P0 | — (自身為基礎) |
| **State Management** | 編排狀態追蹤、倉庫狀態同步 | P0 | StateStoreProvider |
| **Repo Operations** | 倉庫 checkout、sync、push、PR | P0 | RepoProvider |
| **Secret Management** | 加密存儲、作用域隔離、旋轉 | P0 | SecretsProvider |
| **Auth Service** | 認證、授權、JWT 管理 | P0 | AuthProvider |
| **Deployment** | 多模式部署、回滾、環境管理 | P1 | DeployProvider |
| **Notification** | 多通道通知、模板插值、送達追蹤 | P1 | NotificationProvider |
| **Validation** | YAML/JSON 語法、命名規範、依賴審計 | P1 | ValidationProvider |
| **Security Scan** | 秘密檢測、依賴掃描、SBOM 生成 | P1 | SecurityScannerProvider |
| **Observability** | 結構化日誌、指標收集、分佈式追蹤 | P1 | ObservabilityProvider |
| **Queue System** | 任務佇列、優先級排程、消費者管理 | P1 | QueueProvider |
| **Database** | 資料持久化、遷移、交易 | P1 | DatabaseProvider |
| **Storage** | 檔案存儲、Artifact 管理 | P2 | StorageProvider |
| **Sync Engine** | 跨平台同步（GitHub→GitLab/Bitbucket） | P2 | RepoProvider |

---

## 2. 驗收標準（Given-When-Then 格式）

### 2.1 Native Mode 驗收

**AC-2.1.1: 零依賴啟動**
```
Given  平台代碼已 clone 到本地
 And   未配置任何外部服務 secrets
When   執行 npm start
Then   平台以 Native Mode 啟動
 And   12 個 Native Provider 全部初始化成功
 And   healthcheck 全部返回 healthy
 And   啟動時間 < 5 秒
```

**AC-2.1.2: Native State Management**
```
Given  平台在 Native Mode 運行
When   orchestrator 執行一次完整的 validate 動作
Then   執行狀態記錄到本地 JSON 檔案
 And   每個倉庫的狀態獨立追蹤
 And   最終報告包含所有 Tier 結果
```

**AC-2.1.3: Native Security Scan**
```
Given  平台在 Native Mode 運行
When   對任意倉庫執行安全掃描
Then   13 個內建正則模式全部檢測
 And   發現的硬編碼秘密被標記
 And   掃描結果寫入本地報告
```

### 2.2 Connected Mode 驗收

**AC-2.2.1: 自動模式偵測**
```
Given  配置了 ORCH_GITHUB_TOKEN + ORCH_STATE_HOST + ORCH_SLACK_WEBHOOK
When   orchestrator 啟動
Then   自動偵測為 Connected Mode
 And   state_provider = redis
 And   repo_provider = github
 And   notify_provider = slack
```

**AC-2.2.2: Redis State Provider**
```
Given  ORCH_STATE_HOST 和 ORCH_STATE_PASSWORD 已配置
When   orchestrator 初始化 state store
Then   成功連接 Redis
 And   執行狀態寫入 Redis with 86400s TTL
 And   最終報告寫入 Redis with 604800s TTL
```

**AC-2.2.3: Slack Notification**
```
Given  ORCH_SLACK_WEBHOOK 已配置
When   orchestrator 完成所有 Tier 執行
Then   發送包含 Run ID、Mode、各 Tier 狀態的通知到 Slack
```

### 2.3 Hybrid Mode 驗收

**AC-2.3.1: 混合 Provider 選擇**
```
Given  僅配置了 ORCH_GITHUB_TOKEN（無 Redis、無 Slack）
When   orchestrator 啟動
Then   自動偵測為 Hybrid Mode
 And   state_provider = native（無 Redis）
 And   repo_provider = github（有 token）
 And   notify_provider = native（無 Slack）
```

**AC-2.3.2: Provider Failover**
```
Given  平台在 Hybrid Mode 運行
 And   Redis 連接中途斷線
When   下一次狀態寫入操作
Then   自動 failover 到 Native state provider
 And   記錄 warning 日誌
 And   後續狀態持續寫入本地 JSON
```

### 2.4 工作流驗收

**AC-2.4.1: 分層並行執行**
```
Given  25 個倉庫分佈在 5 個 Tier
When   orchestrator 執行 validate 動作
Then   Tier 0 先執行（最多 5 並行）
 And   Tier 0 完成後 Tier 1 開始（最多 8 並行）
 And   依次 Tier 2 → Tier 3 → Tier 4
 And   同一 Tier 內的倉庫並行執行
```

**AC-2.4.2: 單庫失敗不阻斷**
```
Given  Tier 1 中有 6 個倉庫
 And   其中 codexvanta-os-event-bus validate 失敗
When   Tier 1 執行
Then   其餘 5 個倉庫正常完成
 And   最終狀態為 partial_failure
 And   event-bus 失敗細節記錄在報告中
```

**AC-2.4.3: Dry Run 模式**
```
Given  用戶選擇 dry_run = true
When   orchestrator 執行任何動作
Then   所有操作僅模擬，不實際執行
 And   輸出中包含 [DRY RUN] 標記
 And   不修改任何倉庫狀態
```

**AC-2.4.4: Provider-Agnostic 驗證**
```
Given  repository-runner 執行 validate 動作
When   檢查目標倉庫
Then   掃描源碼中的硬編碼外部服務引用
 And   發現 redis://localhost、REDIS_HOST 等模式時標記警告
 And   驗證 REPO_MANIFEST.yaml 完整性
```

### 2.5 REPO_MANIFEST 驗收

**AC-2.5.1: Manifest 標準格式**
```
Given  每個倉庫根目錄包含 REPO_MANIFEST.yaml
When   解析 manifest
Then   包含 apiVersion: codexvanta.os/v1
 And   包含 kind: RepoManifest
 And   spec.layer ∈ {A-Builder, B-Runtime, C-NativeServices, D-Connector, E-DeployTarget}
 And   spec.plane ∈ {Control, Governance, Execution, Integration, Data, Decision, Experience, Observability, Sandbox}
 And   spec.tier ∈ {0, 1, 2, 3, 4}
```

---

## 3. 非功能性需求

### 3.1 性能要求

| 指標 | Native Mode | Connected Mode | Hybrid Mode |
|------|------------|----------------|-------------|
| 平台啟動時間 | < 5s | < 30s | < 10s |
| 單倉庫 validate | < 30s | < 30s | < 30s |
| 全量 25 倉庫 validate | < 10min | < 10min | < 10min |
| State 寫入延遲 | < 10ms (memory) | < 50ms (Redis) | < 50ms |
| Provider failover 時間 | N/A | < 5s | < 5s |
| Healthcheck 全部 Provider | < 2s | < 10s | < 5s |

### 3.2 可靠性要求

| 要求 | 實現方式 |
|------|---------|
| Provider 故障隔離 | 單一 Provider 失敗不影響其他 Provider |
| 自動 failover | External → Native 自動降級 |
| 狀態持久化 | Native: 檔案快照；Connected: Redis TTL |
| 工作流冪等性 | 重複執行相同動作產生相同結果 |
| 回滾能力 | 每個倉庫支持基於 Git 的回滾 |

### 3.3 安全要求

| 要求 | 實現方式 |
|------|---------|
| Secrets 加密存儲 | Native: AES-256-GCM；External: 平台託管 |
| 最小權限原則 | Token 僅配置必要的 scope |
| 審計追蹤 | 所有 secret 操作記錄到加密審計日誌 |
| 硬編碼檢測 | 13 正則模式自動掃描 |
| 通訊加密 | External Provider 強制 TLS |

### 3.4 可維護性要求

| 要求 | 實現方式 |
|------|---------|
| Provider 可擴展 | 實作介面即可添加新 Provider |
| 配置集中管理 | registry/ 下統一管理所有配置 |
| 零停機擴展 | 新 Provider 在運行時註冊 |
| 文檔自動化 | REPO_MANIFEST.yaml 驅動 README 生成 |

---

## 4. 約束與假設

### 4.1 技術約束

| 約束 | 說明 |
|------|------|
| TypeScript | 所有 Provider 介面和實作使用 TypeScript |
| Node.js 20+ | 平台運行時環境 |
| GitHub Actions | 主要 CI/CD 引擎（但不硬綁定） |
| YAML + JSON | 配置檔案格式 |
| Kubernetes-style Manifest | REPO_MANIFEST.yaml 格式標準 |

### 4.2 設計假設

| 假設 | 說明 |
|------|------|
| 倉庫數量 | 當前 25 個，架構支持擴展到 100+ |
| Provider 切換 | 任何時刻可在 Native/External 間切換 |
| 網路環境 | Native Mode 不依賴網路連接 |
| 持久化 | Native Mode 使用本地檔案系統持久化 |

---

## 5. 依賴關係

### 5.1 內部依賴

```
ARCHITECTURE.md (v2.0)
  ↓
codexvanta_workflows_rsd.md (本文件 v2.0)
  ↓
codexvanta_workflows_tsd.md (v2.0)
  ↓
├── src/interfaces/ (12 TypeScript 介面)
├── src/providers/native/ (12 Native 實作)
├── src/providers/external/ (External 範例)
├── src/providers/registry.ts (ProviderRegistry)
├── orchestrator.yml v2 (Provider-agnostic 工作流)
├── repository-runner.yml v2 (Provider-agnostic 執行器)
└── registry/ (repos.yaml, dependencies.yaml, queue-config.yaml)
```

### 5.2 外部依賴（全部可選）

| 服務 | 用途 | 對應 Provider | 缺失時行為 |
|------|------|--------------|-----------|
| Redis | 狀態存儲 | StateStoreProvider | 降級至記憶體+檔案 |
| GitHub API | 倉庫操作 | RepoProvider | 降級至本地 Git CLI |
| Slack | 通知 | NotificationProvider | 降級至 Console+File |
| Supabase | 資料庫 | DatabaseProvider | 降級至 SQLite |
| S3/GCS | 檔案存儲 | StorageProvider | 降級至本地檔案系統 |
| Auth0/Clerk | 認證 | AuthProvider | 降級至 JWT+File |
| Datadog/NR | 可觀測 | ObservabilityProvider | 降級至 File+Console |
| Snyk/Trivy | 安全掃描 | SecurityScannerProvider | 降級至內建模式掃描 |

---

## 6. 交付里程碑

| 里程碑 | 內容 | 狀態 |
|--------|------|------|
| M1 | ARCHITECTURE.md 架構宣言 | ✅ 完成 |
| M2 | 12 個 TypeScript 介面定義 | ✅ 完成 |
| M3 | 12 個 Native Provider 實作 | ✅ 完成 |
| M4 | 3 個 External Provider 範例 | ✅ 完成 |
| M5 | ProviderRegistry 運行時偵測器 | ✅ 完成 |
| M6 | 25 倉庫 REPO_MANIFEST + README | ✅ 完成 |
| M7 | Central Registry 更新 | ✅ 完成 |
| M8 | orchestrator.yml v2 + repository-runner.yml v2 | ✅ 完成 |
| M9 | TSD + RSD 改寫 | ✅ 完成 |
| M10 | 文檔全套改寫（multi-repo-orchestration, IMPLEMENTATION_SUMMARY） | 進行中 |
| M11 | 驗證與最終交付 | 待開始 |

---

## 7. 變更歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| 1.0.0 | 2024-03-12 | 初始版本（GitHub-centric WorkflowHub） |
| 2.0.0 | 2024-03-13 | **架構轉型**：重寫為 Native-first / Provider-agnostic 架構。新增 12 Provider 介面需求、三模式運行需求、ProviderRegistry 需求、REPO_MANIFEST 標準、Provider-agnostic 工作流需求。移除所有硬綁定外部服務的需求。 |