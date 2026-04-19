# 技術方案設計（TSD）- CodexvantaOS Workflows v2.0

**版本**：2.0.0  
**日期**：2024-03-13  
**狀態**：定稿（架構轉型：Native-first / Provider-agnostic）  
**上游文檔**：ARCHITECTURE.md v2.0 + codexvanta_workflows_rsd.md v2.0  
**架構哲學**：「第三方服務是平台的擴充出口，不是平台成立的地基。」

---

## 1. 架構總覽

### 1.1 核心設計原則

CodexvantaOS Workflows v2.0 實現了根本性的架構轉型：從「第三方優先」轉向「Native-first / Provider-agnostic」模式。平台的所有核心能力均以零外部依賴的原生實作為基礎，第三方服務僅作為可選的擴充出口。

| 原則 | 說明 | 實踐 |
|------|------|------|
| **Native-first** | 平台在無任何外部服務的情況下完整運行 | 12 個原生 Provider 覆蓋所有能力 |
| **Provider-agnostic** | 所有外部能力通過抽象介面接入 | TypeScript 介面定義 + 運行時切換 |
| **零依賴啟動** | `git clone && npm start` 即可啟動完整平台 | 內建 SQLite、檔案系統、記憶體佇列 |
| **漸進式擴充** | 外部服務按需接入，不影響已有功能 | ProviderRegistry 自動偵測 + 優雅降級 |
| **三模式運行** | Native / Connected / Hybrid 三種運行模式 | 運行時能力偵測自動選擇最佳模式 |

### 1.2 系統架構圖（C4 Level 1）

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CodexvantaOS Platform v2.0                       │
│              Native-first / Provider-agnostic Architecture          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   A. Builder Layer                           │   │
│  │  codexvanta-os-cli            codexvanta-os-code-deconstructor  │
│  │  (開發者工具鏈)                (代碼分析引擎)                   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   B. Runtime Layer (13 repos)                │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │core-main │ │core-kernel│ │scheduler │ │workflows │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │event-bus │ │ai-engine │ │decision  │ │automation│       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │data-pipe │ │app-portal│ │ app-ui   │ │module-   │       │   │
│  │  │ line     │ │          │ │          │ │ suite    │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │  ┌──────────┐                                               │   │
│  │  │fleet-    │                                               │   │
│  │  │ sandbox  │                                               │   │
│  │  └──────────┘                                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 C. Native Services Layer (7 repos)           │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │   │
│  │  │auth-     │ │config-   │ │secret-   │ │policy-   │       │   │
│  │  │ service  │ │ manager  │ │ vault    │ │ engine   │       │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                    │   │
│  │  │control-  │ │observa-  │ │governance│                    │   │
│  │  │ center   │ │ bility   │ │-autonomy │                    │   │
│  │  └──────────┘ └──────────┘ └──────────┘                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                 D. Connector Layer (1 repo)                  │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │ network-mesh (外部服務適配器 + API Gateway)           │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               E. Deployment Target Layer (2 repos)           │   │
│  │  ┌──────────┐ ┌──────────┐                                  │   │
│  │  │infra-base│ │infra-    │                                  │   │
│  │  │          │ │ gitops   │                                  │   │
│  │  └──────────┘ └──────────┘                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              Provider Registry (運行時能力偵測器)              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │   │
│  │  │Database │ │Storage  │ │  Auth   │ │ Queue   │          │   │
│  │  │Provider │ │Provider │ │Provider │ │Provider │          │   │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘          │   │
│  │       │           │           │           │               │   │
│  │  ┌────┴────┐ ┌────┴────┐ ┌────┴────┐ ┌────┴────┐          │   │
│  │  │Native   │ │Native   │ │Native   │ │Native   │          │   │
│  │  │(SQLite) │ │(FS)     │ │(JWT+FS) │ │(Memory) │          │   │
│  │  ├─────────┤ ├─────────┤ ├─────────┤ ├─────────┤          │   │
│  │  │External │ │External │ │External │ │External │          │   │
│  │  │(Supabase│ │(S3/GCS) │ │(Auth0)  │ │(Redis)  │          │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │   │
│  │                                                             │   │
│  │  + StateStore, Secrets, Repo, Deploy, Validation,          │   │
│  │    Security, Observability, Notification (共12個Provider)    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 三種運行模式

```
┌──────────────────────────────────────────────────────────────────┐
│                    Operation Mode Matrix                         │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│   Capability │ Native Mode  │Connected Mode│  Hybrid Mode       │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│ Database     │ SQLite/Memory│ Supabase/PG  │ Per-service choice │
│ State Store  │ Memory+File  │ Redis        │ Redis if available │
│ Auth         │ JWT+File     │ Auth0/Clerk  │ JWT native fallback│
│ Queue        │ Memory+File  │ Redis/SQS    │ Memory fallback    │
│ Secrets      │ AES-256 Vault│ GitHub/Vault │ Vault if available │
│ Repo         │ Local Git    │ GitHub API   │ GitHub if token    │
│ Deploy       │ Local Process│ GH Actions   │ Local + selective  │
│ Observe      │ File+Console │ Datadog/NR   │ File + external    │
│ Notify       │ Console+File │ Slack/Teams  │ Slack if webhook   │
│ Storage      │ Filesystem   │ S3/GCS       │ FS + selective     │
│ Validation   │ Built-in     │ SonarQube    │ Built-in + extend  │
│ Security     │ Pattern Scan │ Snyk/Trivy   │ Pattern + extend   │
├──────────────┼──────────────┼──────────────┼────────────────────┤
│ Dependencies │ 零外部依賴    │ 全外部連接    │ 按需連接            │
│ Startup      │ <5 seconds   │ ~30 seconds  │ ~10 seconds        │
│ Use Case     │ 開發/離線/CI  │ 生產環境      │ 過渡期/混合部署     │
└──────────────┴──────────────┴──────────────┴────────────────────┘
```

---

## 2. Provider 介面架構

### 2.1 共用合約

所有 12 個 Provider 遵循統一的基礎合約：

```typescript
interface BaseProvider {
  readonly providerId: string;      // 唯一識別符（如 'native-database'）
  readonly mode: 'native' | 'external';
  
  init(): Promise<void>;            // 初始化（建表、建目錄、連接池）
  healthcheck(): Promise<Health>;   // 健康檢查（含延遲、版本資訊）
  close(): Promise<void>;           // 優雅關閉（釋放資源、刷新緩衝）
}

interface Health {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms: number;
  details: Record<string, unknown>;
}
```

### 2.2 十二大 Provider 介面

| # | Provider | 介面名稱 | Native 實作 | External 範例 |
|---|----------|----------|-------------|---------------|
| 1 | Database | `DatabaseProvider` | SQLite (better-sqlite3) + 記憶體 | Supabase PostgreSQL |
| 2 | Storage | `StorageProvider` | 檔案系統 + SHA-256 校驗 | S3 / GCS |
| 3 | Auth | `AuthProvider` | HMAC-SHA256 JWT + scrypt + 檔案 | Auth0 / Clerk |
| 4 | Queue | `QueueProvider` | 記憶體優先佇列 + 檔案持久化 | Redis Pub/Sub / SQS |
| 5 | State Store | `StateStoreProvider` | 記憶體 Map + TTL + 檔案快照 | Redis |
| 6 | Secrets | `SecretsProvider` | AES-256-GCM 加密金庫 | GitHub Secrets / Vault |
| 7 | Repo | `RepoProvider` | 本地 Git CLI | GitHub API (Octokit) |
| 8 | Deploy | `DeployProvider` | 本地進程 + Docker 偵測 | GitHub Actions / K8s |
| 9 | Validation | `ValidationProvider` | 內建 linter + JSON Schema | SonarQube |
| 10 | Security | `SecurityScannerProvider` | 13 正則模式掃描 | Snyk / Trivy |
| 11 | Observability | `ObservabilityProvider` | JSONL 日誌 + 記憶體指標 + Span 追蹤 | Datadog / New Relic |
| 12 | Notification | `NotificationProvider` | Console + File + Webhook | Slack / Teams / PagerDuty |

### 2.3 ProviderRegistry（運行時能力偵測器）

```typescript
class ProviderRegistry {
  // 註冊
  registerNative<T>(capability: string, provider: T): void;
  registerExternal<T>(capability: string, provider: T): void;
  
  // 初始化（自動偵測 + 優雅降級）
  async initialize(): Promise<void>;
  
  // 獲取（自動 failover）
  get<T>(capability: string): T;
  
  // 運行時切換
  async switchToNative(capability: string): Promise<void>;
  async switchToExternal(capability: string): Promise<void>;
  
  // 狀態
  status(): Map<string, ProviderStatus>;
  mode(): 'native' | 'connected' | 'hybrid';
  
  // 健康檢查 + 自動 failover
  async healthcheckAll(): Promise<HealthReport>;
}
```

初始化流程：
1. 嘗試初始化 External Provider
2. 若成功 → 使用 External
3. 若失敗 → 自動降級至 Native Provider
4. 持續健康檢查，異常時自動 failover

---

## 3. 平台分層架構

### 3.1 五層架構定義

| 層級 | 名稱 | 職責 | 倉庫數 |
|------|------|------|--------|
| **A** | Builder Layer | 開發者工具鏈、代碼生成、腳手架 | 2 |
| **B** | Runtime Layer | 核心運行時、引擎、處理邏輯 | 13 |
| **C** | Native Services | 平台內建服務（認證、配置、治理） | 7 |
| **D** | Connector Layer | 外部服務適配器、API Gateway | 1 |
| **E** | Deployment Target | 基礎設施定義、GitOps 配置 | 2 |

### 3.2 九大執行平面

| 平面 | 英文 | 倉庫 | 優先級 |
|------|------|------|--------|
| 控制平面 | Control | control-center, core-main | P0 |
| 治理平面 | Governance | secret-vault, config-manager, auth-service, policy-engine, governance-autonomy | P0 |
| 執行平面 | Execution | cli, scheduler, automation-core, core-code-deconstructor, core-kernel, infra-base | P1 |
| 整合平面 | Integration | network-mesh, event-bus, infra-gitops | P1 |
| 數據平面 | Data | data-pipeline | P2 |
| 決策平面 | Decision | ai-engine, decision-engine | P2 |
| 體驗平面 | Experience | app-portal, app-ui, module-suite | P1 |
| 可觀測平面 | Observability | observability-stack | P1 |
| 沙盒平面 | Sandbox | fleet-sandbox | P3 |

### 3.3 分層依賴圖（Tier 0→4）

```
Tier 0 (Foundation)     ─── 無上游依賴
  core-kernel, control-center, workflows

Tier 1 (Core Services)  ─── 依賴 Tier 0
  core-main, event-bus, config-manager, secret-vault, 
  auth-service, policy-engine

Tier 2 (Engines)        ─── 依賴 Tier 0+1
  scheduler, automation-core, ai-engine, decision-engine,
  governance-autonomy, observability-stack, data-pipeline,
  network-mesh

Tier 3 (Applications)   ─── 依賴 Tier 0+1+2
  app-portal, app-ui, module-suite, cli,
  core-code-deconstructor, fleet-sandbox

Tier 4 (Infrastructure) ─── 依賴全部上游
  infra-base, infra-gitops
```

---

## 4. 工作流架構（Provider-Agnostic）

### 4.1 Orchestrator v2 工作流

Orchestrator v2 完全去除了對外部服務的硬綁定，引入了 Phase 0 模式偵測機制：

```
Phase 0: Mode Detection          ← 新增：自動偵測可用 Provider
  ├── 掃描 secrets 和環境變量
  ├── 判斷 operational mode (native/connected/hybrid)
  └── 解析每個能力的 provider (state/repo/notify/deploy)

Phase 1: Preparation
  ├── 載入 registry 配置 (repos.yaml, dependencies.yaml, queue-config.yaml)
  ├── 解析分層執行順序 (Tier 0→4)
  ├── 驗證依賴完整性
  └── 分析受影響倉庫

Phase 2: State Initialization     ← 改造：Provider-agnostic
  ├── 根據 state_provider 選擇初始化方式
  ├── native: 檔案系統 JSON 存儲
  ├── redis: Redis 連接 + TTL 設定
  └── 失敗時自動降級至 native

Phase 3: Tiered Execution (0→4)
  ├── 每層並行執行（max_parallel 配置）
  ├── 層間串行等待（Tier N+1 等待 Tier N 完成）
  ├── fail-fast: false（單一倉庫失敗不阻斷同層其他倉庫）
  └── 呼叫 repository-runner.yml（傳遞 provider 配置）

Phase 4: Finalization
  ├── 收集所有 Tier 執行結果
  ├── 計算整體狀態 (success/partial_failure/mixed)
  ├── Provider-aware 通知（native/slack/webhook）
  └── 上傳報告 artifact
```

### 4.2 Repository Runner v2 工作流

每個倉庫的執行單元，接收 Orchestrator 傳遞的 Provider 配置：

```
Stage 1: Setup
  ├── Checkout（使用可用的 token 或 github.token）
  ├── 讀取 REPO_MANIFEST.yaml（Layer、Plane、Tier 資訊）
  └── 初始化執行上下文

Stage 2: State Recording
  ├── Provider-agnostic 狀態記錄
  ├── native: JSON 檔案到 RUNNER_TEMP
  └── redis: Redis key with TTL

Stage 3: Action Execution
  ├── validate: YAML 語法 + MANIFEST 完整性 + 命名規範 + Provider-agnostic 檢查
  ├── sync: MANIFEST 同步 + README 更新 + 配置對齊
  ├── deploy: 根據 mode 選擇部署策略（native/connected/hybrid）
  ├── rollback: Git 歷史回滾 + 狀態恢復
  └── healthcheck: 倉庫可達性 + MANIFEST + README + Git 狀態

Stage 4: Completion Recording
  ├── 收集所有 action job 結果
  ├── 計算整體狀態
  └── Provider-agnostic 狀態持久化
```

### 4.3 Provider 配置傳遞鏈

```
GitHub Repository Variables (vars.*)
  ├── ORCH_STATE_PROVIDER = auto|native|redis
  ├── ORCH_REPO_PROVIDER = auto|native|github|gitlab
  ├── ORCH_NOTIFY_PROVIDER = auto|native|slack|webhook|teams
  └── ORCH_DEPLOY_PROVIDER = auto|native|github-actions|docker|k8s

GitHub Repository Secrets (secrets.*)
  ├── ORCH_GITHUB_TOKEN (optional — enables github repo provider)
  ├── ORCH_STATE_HOST (optional — enables redis state provider)
  ├── ORCH_STATE_PORT (optional)
  ├── ORCH_STATE_PASSWORD (optional)
  ├── ORCH_SLACK_WEBHOOK (optional — enables slack notify provider)
  └── ORCH_SLACK_TOKEN (optional)

Orchestrator → Runner 傳遞:
  inputs.mode = native|connected|hybrid
  inputs.state_provider = native|redis
  inputs.repo_provider = native|github|gitlab
```

---

## 5. 25 倉庫映射

### 5.1 倉庫清單與架構定位

| # | 倉庫名稱 | 層級 | 平面 | Tier | 核心 Provider 依賴 |
|---|----------|------|------|------|-------------------|
| 1 | codexvanta-os-core-kernel | B-Runtime | Execution | 0 | Database, Queue, StateStore |
| 2 | codexvanta-os-control-center | C-NativeServices | Control | 0 | StateStore, Repo, Secrets |
| 3 | codexvanta-os-workflows | B-Runtime | Control | 0 | Deploy, Notification |
| 4 | codexvanta-os-core-main | B-Runtime | Control | 1 | Database, Auth, Queue |
| 5 | codexvanta-os-event-bus | B-Runtime | Integration | 1 | Queue, StateStore |
| 6 | codexvanta-os-config-manager | C-NativeServices | Governance | 1 | Storage, Secrets |
| 7 | codexvanta-os-secret-vault | C-NativeServices | Governance | 1 | Secrets, Auth |
| 8 | codexvanta-os-auth-service | C-NativeServices | Governance | 1 | Auth, Database |
| 9 | codexvanta-os-policy-engine | C-NativeServices | Governance | 1 | Validation, Database |
| 10 | codexvanta-os-scheduler | B-Runtime | Execution | 2 | Queue, StateStore, Database |
| 11 | codexvanta-os-automation-core | B-Runtime | Execution | 2 | Queue, Deploy, Notification |
| 12 | codexvanta-os-ai-engine | B-Runtime | Decision | 2 | Database, Queue, Storage |
| 13 | codexvanta-os-decision-engine | B-Runtime | Decision | 2 | Database, StateStore |
| 14 | codexvanta-os-governance-autonomy | C-NativeServices | Governance | 2 | Validation, Security, Repo |
| 15 | codexvanta-os-observability-stack | C-NativeServices | Observability | 2 | Observability, Storage |
| 16 | codexvanta-os-data-pipeline | B-Runtime | Data | 2 | Database, Storage, Queue |
| 17 | codexvanta-os-network-mesh | D-Connector | Integration | 2 | Auth, StateStore |
| 18 | codexvanta-os-app-portal | B-Runtime | Experience | 3 | Auth, Database, Storage |
| 19 | codexvanta-os-app-ui | B-Runtime | Experience | 3 | Auth, Storage |
| 20 | codexvanta-os-module-suite | B-Runtime | Experience | 3 | Database, Storage |
| 21 | codexvanta-os-cli | A-Builder | Execution | 3 | Repo, Deploy, Validation |
| 22 | codexvanta-os-core-code-deconstructor | A-Builder | Execution | 3 | Database, Security, Storage |
| 23 | codexvanta-os-fleet-sandbox | B-Runtime | Sandbox | 3 | Deploy, Security, Observability |
| 24 | codexvanta-os-infra-base | E-DeployTarget | Execution | 4 | Deploy, Validation, Security |
| 25 | codexvanta-os-infra-gitops | E-DeployTarget | Integration | 4 | Repo, Deploy, Validation |

### 5.2 每倉庫標準檔案結構

```
codexvanta-os-{name}/
├── REPO_MANIFEST.yaml          ← Kubernetes-style 架構宣言
├── README.md                   ← 含 Architecture 區段
├── src/
│   └── providers/
│       └── index.ts            ← 該倉庫使用的 Provider 注入點
├── package.json
├── tsconfig.json
└── .github/
    └── workflows/              ← 可選：倉庫自有工作流
```

### 5.3 REPO_MANIFEST.yaml 標準格式

```yaml
apiVersion: codexvanta.os/v1
kind: RepoManifest
metadata:
  name: codexvanta-os-{name}
  namespace: codexvanta-os
  labels:
    platform: codexvanta-os
    architecture: native-first
    version: "2.0"
spec:
  layer: B-Runtime           # A-Builder | B-Runtime | C-NativeServices | D-Connector | E-DeployTarget
  plane: Execution           # Control | Governance | Execution | Integration | Data | Decision | Experience | Observability | Sandbox
  tier: 1                    # 0-4，越小越基礎
  capabilities:
    provides:                # 本倉庫提供的能力
      - workflow-orchestration
    consumes:                # 本倉庫消費的 Provider
      - database
      - queue
      - state-store
  dependencies:
    runtime:                 # 運行時依賴的其他倉庫
      - codexvanta-os-core-kernel
    build:                   # 構建時依賴
      - codexvanta-os-config-manager
  tags:
    - core
    - runtime
```

---

## 6. 配置管理

### 6.1 Central Registry（codexvanta-os-control-center/registry/）

**repos.yaml** — 25 倉庫完整註冊表，包含層級、平面、Tier、標籤、Provider 依賴。

**dependencies.yaml** — 5 層 Tier 依賴圖，定義並行執行順序和依賴關係。

**queue-config.yaml** — 10 個佇列主題定義，Provider-agnostic（不綁定 Redis/SQS）。

### 6.2 Provider 配置策略

```
配置優先級（從高到低）：
1. 環境變量（ORCH_*_PROVIDER）
2. GitHub Repository Variables（vars.*）
3. REPO_MANIFEST.yaml 中的 spec.providers
4. ProviderRegistry 自動偵測
5. 默認值（always native）
```

---

## 7. 安全架構

### 7.1 Secrets 管理（Provider-Agnostic）

| 模式 | 存儲 | 加密 | 旋轉 |
|------|------|------|------|
| Native | 本地 AES-256-GCM 加密金庫 | 自動生成 master key | 手動 |
| Connected | GitHub Secrets / HashiCorp Vault | 平台託管 | 自動 |
| Hybrid | 敏感資料用 Vault，其餘用 Native | 混合 | 按需 |

### 7.2 認證架構

| 模式 | Token | 存儲 | Session |
|------|-------|------|---------|
| Native | HMAC-SHA256 JWT | 檔案 (0o600 權限) | 本地 scrypt hash |
| Connected | OAuth2 / OIDC | 外部 IdP | 外部 session store |
| Hybrid | JWT native + 外部 IdP | 混合 | JWT fallback |

### 7.3 安全掃描（Provider-Agnostic）

Native 內建 13 種正則模式掃描：
- AWS Access Key / Secret Key
- GitHub Token / Personal Access Token
- Private Key (RSA/EC/OPENSSH)
- 通用密碼模式（password=, secret=）
- JWT Token
- 資料庫連接字串
- Generic API Key

---

## 8. 可觀測性架構

### 8.1 三大支柱

| 支柱 | Native 實作 | External 選項 |
|------|------------|---------------|
| **Logging** | JSONL 結構化日誌 → 檔案 + Console | ELK / CloudWatch / Datadog |
| **Metrics** | 記憶體計數器/量規/直方圖 + 保留修剪 | Prometheus / CloudWatch / New Relic |
| **Tracing** | Span 樹追蹤 → 記憶體 + 檔案 | Jaeger / Zipkin / Datadog APM |

### 8.2 告警

| 模式 | 觸發 | 通道 |
|------|------|------|
| Native | 閾值比對（記憶體中） | Console + File + Webhook |
| Connected | 外部規則引擎 | Slack + PagerDuty + Email |

---

## 9. 部署架構

### 9.1 部署模式矩陣

| 模式 | 構建 | 部署目標 | 回滾 |
|------|------|---------|------|
| Native | 本地 npm/docker build | 本地進程 / Docker | Git reset |
| Connected | CI/CD Pipeline | Cloudflare / Vercel / GKE | Platform rollback |
| Hybrid | 本地構建 + CI 部署 | 按可用性選擇 | Git + Platform |

### 9.2 零依賴啟動流程

```bash
# 1. Clone（無需任何外部服務配置）
git clone https://github.com/codexvanta-os/codexvanta-os-core-kernel.git
cd codexvanta-os-core-kernel

# 2. Install（僅 npm 依賴）
npm install

# 3. Start（Native Mode — 自動偵測無外部服務 → 啟用全部 Native Provider）
npm start
# ✅ SQLite database initialized
# ✅ Filesystem storage ready
# ✅ JWT auth initialized (master key auto-generated)
# ✅ Memory queue ready
# ✅ Memory state store ready
# ✅ AES-256-GCM secret vault initialized
# ✅ Local git provider ready
# ✅ Local deploy provider ready
# ✅ Built-in validators ready
# ✅ Pattern-based security scanner ready
# ✅ File+Console observability ready
# ✅ Console+File notification ready
# 🚀 Platform running in NATIVE mode (12/12 providers active)
```

---

## 10. 遷移路徑

### 10.1 從 v1 到 v2 遷移清單

| 步驟 | 操作 | 影響範圍 |
|------|------|---------|
| 1 | 移除所有硬編碼的 Redis 連接 | state-manager.py, workflows |
| 2 | 將 `REDIS_*` secrets 重命名為 `ORCH_STATE_*` | GitHub Secrets |
| 3 | 將 `GH_TOKEN` 重命名為 `ORCH_GITHUB_TOKEN` | GitHub Secrets |
| 4 | 部署 REPO_MANIFEST.yaml 到每個倉庫 | 25 repos |
| 5 | 更新 orchestrator.yml 到 v2 | workflows repo |
| 6 | 更新 repository-runner.yml 到 v2 | workflows repo |
| 7 | 設置 `ORCH_*_PROVIDER` 變量（可選） | GitHub Variables |
| 8 | 驗證 Native Mode 功能完整性 | 全平台 |
| 9 | 逐步啟用 External Providers | 按需 |

### 10.2 向後兼容性

- v1 的 `ORCH_STATE_*` secrets 仍然有效（在 Connected 模式下使用）
- 不設置任何 `ORCH_*_PROVIDER` 變量 → 自動偵測模式（向後兼容）
- REPO_MANIFEST.yaml 缺失時降級為基本功能（不阻斷執行）

---

## 11. 驗收標準

### 11.1 Native Mode 必須通過

| 場景 | 期望結果 |
|------|---------|
| 零外部 secrets 啟動 | ✅ 平台以 Native 模式完整運行 |
| orchestrator.yml 在 Native 模式執行 | ✅ 所有 5 層 Tier 順序執行，狀態記錄到檔案 |
| repository-runner.yml validate 動作 | ✅ MANIFEST 驗證、命名檢查、Provider-agnostic 檢查全部通過 |
| repository-runner.yml sync 動作 | ✅ MANIFEST 同步、README 更新、本地 commit |
| 所有 12 個 Native Provider healthcheck | ✅ 全部 healthy |

### 11.2 Connected Mode 必須通過

| 場景 | 期望結果 |
|------|---------|
| 配置完整 secrets 啟動 | ✅ 平台自動切換到 Connected 模式 |
| Redis 狀態存儲 | ✅ 執行狀態寫入 Redis with TTL |
| GitHub API 操作 | ✅ 倉庫 checkout/push 使用 ORCH_GITHUB_TOKEN |
| Slack 通知 | ✅ 完成報告推送到 Slack |

### 11.3 Hybrid Mode 必須通過

| 場景 | 期望結果 |
|------|---------|
| 部分 secrets 配置 | ✅ 自動偵測 Hybrid 模式 |
| Redis 可用但無 Slack | ✅ 狀態用 Redis，通知用 Native |
| Redis 中途斷線 | ✅ 自動 failover 到 Native 狀態存儲 |
| External Provider 恢復 | ✅ 自動切回 External |

---

## 12. 變更歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| 1.0.0 | 2024-03-12 | 初始版本（GitHub-centric） |
| 2.0.0 | 2024-03-13 | **架構轉型**：Native-first / Provider-agnostic。移除所有硬綁定外部服務依賴。引入 12 Provider 介面架構、3 運行模式、5 層 + 9 平面架構、ProviderRegistry 運行時能力偵測、Phase 0 模式偵測機制。 |