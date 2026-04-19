# CodexvantaOS 25倉庫全自動化同步多工併發/並行流程完整設計 v2.0

**版本**: 2.0.0  
**狀態**: Definitive  
**日期**: 2024-03-13  
**架構**: Native-first / Provider-agnostic  
**哲學**: 「第三方服務是平台的擴充出口，不是平台成立的地基。」

---

## 1. 執行摘要

本文檔定義25個CodexvantaOS倉庫的**全自動化同步多工併發/並行流程**的完整設計。v2.0 實現了根本性的架構轉型：所有自動化流程在零外部依賴的情況下完整運行，第三方服務（Redis、GitHub API、Slack）僅作為可選的效能擴充出口。

### 1.1 核心目標

1. **零依賴自動化**: 無需配置任何外部服務即可執行完整編排流程
2. **Provider-agnostic 設計**: 所有外部能力通過抽象介面存取，運行時自動選擇最佳 Provider
3. **智能併發**: 基於5層 Tier 依賴圖的自動併發優化
4. **故障隔離 + 自動降級**: 單一倉庫/Provider 失敗不影響整體流程
5. **三模式運行**: Native / Connected / Hybrid 模式自動偵測與切換
6. **完整可觀測性**: Provider-agnostic 日誌、指標、追蹤

### 1.2 關鍵指標

| 指標 | Native Mode | Connected Mode | Hybrid Mode |
|------|------------|----------------|-------------|
| 端到端執行時間 | ≤ 15分鐘 | ≤ 30分鐘 | ≤ 20分鐘 |
| 併發效率 | ≥ 80% | ≥ 85% | ≥ 85% |
| 自動恢復成功率 | ≥ 95% | ≥ 95% | ≥ 98% |
| 故障隔離度 | 100% | 100% | 100% |
| 監控覆蓋率 | 100% | 100% | 100% |
| 啟動時間 | < 5s | < 30s | < 10s |
| Provider failover 時間 | N/A | < 5s | < 5s |

### 1.3 v1 vs v2 對比

| 面向 | v1 (Third-party-first) | v2 (Native-first) |
|------|----------------------|-------------------|
| 狀態管理 | 硬綁定 Redis | StateStoreProvider（native/redis） |
| 倉庫操作 | 硬綁定 GitHub API | RepoProvider（native/github） |
| 通知 | 硬綁定 Slack | NotificationProvider（native/slack/webhook） |
| 秘密管理 | 僅 GitHub Secrets | SecretsProvider（native vault/external） |
| 啟動條件 | 所有 secrets 必須配置 | `git clone && npm start` |
| 失敗行為 | Redis 不可用→工作流失敗 | 自動降級至 Native Provider |
| 監控 | Prometheus + CloudWatch | ObservabilityProvider（native file/external） |

---

## 2. 自動化觸發機制

### 2.1 多維度觸發源（Provider-Agnostic）

#### 2.1.1 手動觸發（workflow_dispatch）

```yaml
on:
  workflow_dispatch:
    inputs:
      action:
        type: choice
        options: [sync, deploy, validate, rollback, healthcheck]
      mode:
        type: choice
        options: [auto, native, connected, hybrid]
      target_planes:
        type: string
        default: ''
      repositories:
        type: string
        default: ''
      dry_run:
        type: boolean
        default: false
      force:
        type: boolean
        default: false
```

#### 2.1.2 計畫觸發

```yaml
on:
  schedule:
    - cron: '0 2 * * *'   # UTC 02:00 每日同步
```

#### 2.1.3 事件觸發（Connected Mode）

```yaml
# 當 RepoProvider = github 時可用
on:
  repository_dispatch:
    types: [governance-trigger, policy-update, dependency-update]
  workflow_run:
    workflows: ['Repository Update']
    types: [completed]
    branches: [main]
```

#### 2.1.4 觸發模式對照

| 觸發方式 | Native Mode | Connected Mode | Hybrid Mode |
|----------|------------|----------------|-------------|
| workflow_dispatch | ✅ | ✅ | ✅ |
| schedule (cron) | ✅ | ✅ | ✅ |
| repository_dispatch | ❌ | ✅ | ✅ (if github token) |
| workflow_run | ❌ | ✅ | ✅ (if github token) |

---

## 3. 執行流程全貌

### 3.1 五階段執行流程

```
┌─────────────────────────────────────────────────────────────────┐
│                   Complete Automation Flow v2.0                   │
│               Native-first / Provider-agnostic                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Phase 0: MODE DETECTION (新增)                              │ │
│  │                                                            │ │
│  │  ┌─────────┐    ┌──────────┐    ┌──────────┐             │ │
│  │  │ 掃描     │───▶│ 偵測能力  │───▶│ 輸出配置  │             │ │
│  │  │ Secrets  │    │ 計數外部  │    │ Provider │             │ │
│  │  └─────────┘    └──────────┘    └──────────┘             │ │
│  │                                                            │ │
│  │  輸入: GitHub secrets 和環境變量                            │ │
│  │  輸出: operational_mode, state_provider, repo_provider,    │ │
│  │        notify_provider, deploy_provider                    │ │
│  │                                                            │ │
│  │  判斷邏輯:                                                 │ │
│  │    外部服務數 = 0  → native mode                           │ │
│  │    外部服務數 ≥ 3  → connected mode                        │ │
│  │    其他           → hybrid mode                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Phase 1: PREPARATION                                       │ │
│  │                                                            │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │ 載入配置     │  │ 解析依賴      │  │ 驗證完整性      │  │ │
│  │  │ repos.yaml  │  │ dependencies  │  │ YAML + cross-ref│  │ │
│  │  │ deps.yaml   │  │ Tier 0→4     │  │ ARCHITECTURE.md │  │ │
│  │  │ queue.yaml  │  │              │  │                 │  │ │
│  │  └─────────────┘  └──────────────┘  └─────────────────┘  │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ 分析受影響倉庫                                        │ │ │
│  │  │ ├── 指定倉庫 → 精確匹配                               │ │ │
│  │  │ ├── 指定平面 → 按 plane 過濾                          │ │ │
│  │  │ └── 無指定   → 全部 25 倉庫                           │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  Provider-aware 依賴安裝:                                  │ │
│  │    native mode  → pip install pyyaml                      │ │
│  │    redis state  → pip install pyyaml redis                │ │
│  │    github repo  → pip install pyyaml PyGithub             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Phase 2: STATE INITIALIZATION                              │ │
│  │                                                            │ │
│  │  State Provider = ?                                        │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ "native" ───▶ 建立 JSON 檔案到 $RUNNER_TEMP          │ │ │
│  │  │                                                      │ │ │
│  │  │ "redis"  ───▶ 嘗試 Redis 連接                        │ │ │
│  │  │               ├── 成功 → 寫入初始狀態 (TTL: 86400s)   │ │ │
│  │  │               └── 失敗 → 降級至 native ↑              │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  狀態結構:                                                 │ │
│  │  {                                                        │ │
│  │    "run_id": "orch-20240313-143022-42",                   │ │
│  │    "status": "initializing",                              │ │
│  │    "mode": "native|connected|hybrid",                     │ │
│  │    "providers": {state, repo, notify, deploy},            │ │
│  │    "started_at": "2024-03-13T14:30:22Z",                 │ │
│  │    "repositories": {}                                     │ │
│  │  }                                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Phase 3: TIERED EXECUTION (核心併發引擎)                    │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Tier 0: Foundation (3 repos, max_parallel: 5)        │ │ │
│  │  │ ┌────────────┐ ┌────────────────┐ ┌────────────┐   │ │ │
│  │  │ │core-kernel │ │control-center  │ │workflows   │   │ │ │
│  │  │ └────────────┘ └────────────────┘ └────────────┘   │ │ │
│  │  └──────────────────────────┬───────────────────────────┘ │ │
│  │                             │ 等待完成                     │ │
│  │                             ▼                              │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Tier 1: Core Services (6 repos, max_parallel: 8)     │ │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐             │ │ │
│  │  │ │core-main │ │event-bus │ │config-mgr│             │ │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘             │ │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐             │ │ │
│  │  │ │secret-vlt│ │auth-svc  │ │policy-eng│             │ │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘             │ │ │
│  │  └──────────────────────────┬───────────────────────────┘ │ │
│  │                             │ 等待完成                     │ │
│  │                             ▼                              │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Tier 2: Engines (8 repos, max_parallel: 8)           │ │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│ │ │
│  │  │ │scheduler │ │automation│ │ai-engine │ │decision  ││ │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘│ │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│ │ │
│  │  │ │governance│ │observa.  │ │data-pipe │ │net-mesh  ││ │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘│ │ │
│  │  └──────────────────────────┬───────────────────────────┘ │ │
│  │                             │ 等待完成                     │ │
│  │                             ▼                              │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Tier 3: Applications (6 repos, max_parallel: 8)      │ │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐             │ │ │
│  │  │ │app-portal│ │app-ui    │ │module-st │             │ │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘             │ │ │
│  │  │ ┌──────────┐ ┌──────────┐ ┌──────────┐             │ │ │
│  │  │ │cli       │ │code-decon│ │fleet-sbx │             │ │ │
│  │  │ └──────────┘ └──────────┘ └──────────┘             │ │ │
│  │  └──────────────────────────┬───────────────────────────┘ │ │
│  │                             │ 等待完成                     │ │
│  │                             ▼                              │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ Tier 4: Infrastructure (2 repos, max_parallel: 5)    │ │ │
│  │  │ ┌──────────┐ ┌──────────┐                           │ │ │
│  │  │ │infra-base│ │infra-gops│                           │ │ │
│  │  │ └──────────┘ └──────────┘                           │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  │                                                            │ │
│  │  每倉庫執行 repository-runner.yml v2:                      │ │
│  │  ├── validate: MANIFEST + 命名 + Provider-agnostic 檢查   │ │
│  │  ├── sync: 配置對齊 + MANIFEST 同步                       │ │
│  │  ├── deploy: 模式感知部署 (native/connected/hybrid)       │ │
│  │  ├── rollback: Git-based 回滾                             │ │
│  │  └── healthcheck: 倉庫健康檢查                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                           │                                      │
│                           ▼                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Phase 4: FINALIZATION & REPORTING                          │ │
│  │                                                            │ │
│  │  ┌────────────┐  ┌────────────┐  ┌─────────────────────┐ │ │
│  │  │ 收集結果    │  │ 計算狀態    │  │ Provider-aware 通知  │ │ │
│  │  │ T0~T4      │  │ success/   │  │ native: stdout+file │ │ │
│  │  │ 結果匯總    │  │ partial_   │  │ slack: webhook POST │ │ │
│  │  │            │  │ failure/   │  │ webhook: HTTP POST  │ │ │
│  │  │            │  │ mixed      │  │                     │ │ │
│  │  └────────────┘  └────────────┘  └─────────────────────┘ │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │ 報告持久化                                            │ │ │
│  │  │ ├── native: JSON 到 $RUNNER_TEMP + artifact 上傳      │ │ │
│  │  │ └── redis: Redis key (TTL: 604800s) + artifact 上傳   │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Repository Runner 執行詳細流程

### 4.1 Per-Repo 執行管線

每個倉庫通過 `repository-runner.yml v2` 獨立執行，接收 Orchestrator 傳遞的 Provider 配置：

```
┌────────────────────────────────────────────────────────────┐
│           Repository Runner Pipeline v2.0                   │
│           (per repository, provider-agnostic)               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Stage 1: SETUP                                            │
│  ├── Checkout workflows repo                               │
│  ├── Checkout target repository                            │
│  │   └── Token: ORCH_GITHUB_TOKEN || github.token          │
│  ├── Generate execution_id                                 │
│  └── Read REPO_MANIFEST.yaml                               │
│      ├── Extract layer (A-Builder...E-DeployTarget)        │
│      ├── Extract plane (Control...Sandbox)                 │
│      └── Extract tier (0-4)                                │
│                                                            │
│  Stage 2: STATE RECORDING (開始)                            │
│  ├── state_provider = native?                              │
│  │   └── 寫入 JSON 到 $RUNNER_TEMP/orch-state/repos/      │
│  └── state_provider = redis?                               │
│      ├── 成功 → 寫入 Redis key                              │
│      └── 失敗 → 降級至 native ↑                             │
│                                                            │
│  Stage 3: ACTION EXECUTION (根據 inputs.action)             │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ validate:                                             │ │
│  │ ├── 1. 倉庫可達性檢查                                  │ │
│  │ ├── 2. REPO_MANIFEST.yaml 存在 + 有效 YAML            │ │
│  │ ├── 3. MANIFEST 必要欄位 (layer, plane, tier)         │ │
│  │ ├── 4. README.md 存在                                 │ │
│  │ ├── 5. 命名規範 (codexvanta-os- 前綴)                 │ │
│  │ ├── 6. 配置檔案語法 (package.json, tsconfig.json)     │ │
│  │ └── 7. Provider-agnostic 檢查 (NEW v2)                │ │
│  │     ├── 掃描 redis://localhost                        │ │
│  │     ├── 掃描 REDIS_HOST, REDIS_PORT                   │ │
│  │     ├── 掃描 process.env.REDIS                        │ │
│  │     └── 標記警告（不阻斷）                              │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ sync:                                                 │ │
│  │ ├── 1. 比對 control-center 的 MANIFEST 版本           │ │
│  │ ├── 2. 複製更新的 MANIFEST（如較新）                    │ │
│  │ ├── 3. 檢查 README.md 架構區段                        │ │
│  │ ├── 4. Git commit（如有變更）                          │ │
│  │ └── 5. Git push（僅 repo_provider=github 時）         │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ deploy (模式感知):                                    │ │
│  │ ├── Native:    deps → build → test → local deploy    │ │
│  │ ├── Connected: deps → build → test → container →     │ │
│  │ │              registry → platform deploy             │ │
│  │ └── Hybrid:    native build → selective deploy       │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ rollback:                                             │ │
│  │ ├── 找到最後的 orchestrator commit 之前的版本          │ │
│  │ ├── dry_run? → 報告目標版本                           │ │
│  │ └── live?    → git reset --hard                      │ │
│  └──────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ healthcheck:                                          │ │
│  │ ├── 倉庫可達                                          │ │
│  │ ├── MANIFEST 存在                                     │ │
│  │ ├── README 存在                                       │ │
│  │ ├── 無斷裂符號連結                                     │ │
│  │ └── Git 初始化                                        │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                            │
│  Stage 4: STATE RECORDING (完成)                            │
│  ├── 收集所有 action job 結果                               │
│  ├── 計算整體狀態 (success/failure)                         │
│  └── Provider-agnostic 持久化 (native file / redis)        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 5. Provider 配置與傳遞

### 5.1 配置層級

```
                    優先級
                      ↑
                      │
┌─────────────────────┼────────────────────────┐
│ 1. workflow_dispatch │ inputs.mode (最高)      │
├─────────────────────┼────────────────────────┤
│ 2. GitHub Variables  │ vars.ORCH_*_PROVIDER   │
├─────────────────────┼────────────────────────┤
│ 3. Auto-detection    │ 根據 secrets 可用性     │
├─────────────────────┼────────────────────────┤
│ 4. Default           │ always native (最低)   │
└─────────────────────┴────────────────────────┘
```

### 5.2 Provider 傳遞鏈

```
GitHub Settings
  ├── vars.ORCH_STATE_PROVIDER = auto|native|redis
  ├── vars.ORCH_REPO_PROVIDER = auto|native|github|gitlab
  ├── vars.ORCH_NOTIFY_PROVIDER = auto|native|slack|webhook|teams
  └── vars.ORCH_DEPLOY_PROVIDER = auto|native|github-actions|docker|k8s

  ├── secrets.ORCH_GITHUB_TOKEN (optional)
  ├── secrets.ORCH_STATE_HOST (optional)
  ├── secrets.ORCH_STATE_PORT (optional)
  ├── secrets.ORCH_STATE_PASSWORD (optional)
  ├── secrets.ORCH_SLACK_WEBHOOK (optional)
  └── secrets.ORCH_SLACK_TOKEN (optional)

         │
         ▼ Phase 0: Mode Detection
         │
Orchestrator outputs:
  ├── operational_mode = native|connected|hybrid
  ├── state_provider = native|redis
  ├── repo_provider = native|github
  ├── notify_provider = native|slack|webhook
  └── deploy_provider = native|github-actions

         │
         ▼ workflow_call inputs
         │
Repository Runner inputs:
  ├── mode = native|connected|hybrid
  ├── state_provider = native|redis
  └── repo_provider = native|github
```

### 5.3 模式自動偵測邏輯

```python
# 能力掃描
has_github = bool(secrets.ORCH_GITHUB_TOKEN)
has_redis = bool(secrets.ORCH_STATE_HOST and
                 secrets.ORCH_STATE_PORT and
                 secrets.ORCH_STATE_PASSWORD)
has_slack = bool(secrets.ORCH_SLACK_WEBHOOK or
                 secrets.ORCH_SLACK_TOKEN)

external_count = sum([has_github, has_redis, has_slack])

# 模式決定
if external_count == 0:
    mode = "native"       # 零外部依賴
elif external_count >= 3:
    mode = "connected"    # 全外部服務
else:
    mode = "hybrid"       # 部分外部服務

# Per-capability provider 解析
state_provider = "redis" if has_redis else "native"
repo_provider = "github" if has_github else "native"
notify_provider = "slack" if has_slack else "native"
deploy_provider = "native"  # default
```

---

## 6. 錯誤處理與自動恢復

### 6.1 Provider Failover 機制

```
┌─────────────────────────────────────────────────────┐
│           Provider Failover Decision Tree            │
│                                                      │
│  External Provider Init                              │
│  ├── 成功 → 使用 External                            │
│  └── 失敗 → 記錄 Warning                             │
│              └── Init Native Provider                │
│                  ├── 成功 → 使用 Native (降級模式)     │
│                  └── 失敗 → CRITICAL ERROR            │
│                                                      │
│  Runtime Health Check                                │
│  ├── External healthy → 繼續使用                      │
│  └── External unhealthy → 自動切換至 Native           │
│                           └── 記錄 failover 事件      │
│                                                      │
│  Recovery (重啟時)                                    │
│  └── 重新嘗試 External → 成功則切回                    │
└─────────────────────────────────────────────────────┘
```

### 6.2 工作流錯誤隔離

| 錯誤範圍 | 行為 | 影響 | 配置 |
|----------|------|------|------|
| 單倉庫 validate 失敗 | 標記失敗，同 Tier 其他倉庫繼續 | `fail-fast: false` | 矩陣策略 |
| 整個 Tier 失敗 | 下一 Tier 仍然執行 | 最終狀態 `partial_failure` | `if: always()` |
| State Provider 斷線 | 自動降級至 native file | 對工作流透明 | 內建 failover |
| Notify Provider 失敗 | 降級至 stdout 日誌 | 非阻塞 | try/catch |
| Repo checkout 失敗 | `continue-on-error: true` | 該倉庫標記不可達 | Git fallback |

### 6.3 回滾策略

```
回滾觸發條件:
1. 手動: workflow_dispatch action=rollback
2. 自動: 部署後 healthcheck 失敗 (future)

回滾執行:
┌─────────────────────────────────────────────┐
│ 1. 找到最後 orchestrator commit 之前的版本    │
│ 2. dry_run? → 報告目標版本，不執行            │
│ 3. live?    → git reset --hard              │
│ 4. repo_provider=github? → git push --force  │
│ 5. 記錄回滾狀態到 state provider              │
└─────────────────────────────────────────────┘
```

---

## 7. 監控與可觀測性

### 7.1 結構化日誌（所有模式）

每個階段和步驟產生結構化日誌：

```
🔍 Detecting operational mode...
  ✅ GitHub Token: available
  ⚪ Redis: not configured (will use native state store)
  ⚪ Slack: not configured (will use native notifications)
  🔄 Auto-detected mode: hybrid (1 external providers)
  📋 Provider summary: hybrid|state=native|repo=github|notify=native|deploy=native

🚀 Orchestration Run: orch-20240313-143022-42
   Mode: hybrid
   Providers: hybrid|state=native|repo=github|notify=native|deploy=native

📋 Execution order: 5 tiers, 25 repositories
   Tier 0: 3 repos → core-kernel, control-center, workflows
   Tier 1: 6 repos → core-main, event-bus, config-manager...
   Tier 2: 8 repos → scheduler, automation-core, ai-engine...
   Tier 3: 6 repos → app-portal, app-ui, module-suite...
   Tier 4: 2 repos → infra-base, infra-gitops

✅ All validations passed

📊 Orchestration Report
   Run ID: orch-20240313-143022-42
   Mode: hybrid
   Status: success
   ✅ tier_0: success
   ✅ tier_1: success
   ✅ tier_2: success
   ✅ tier_3: success
   ✅ tier_4: success
```

### 7.2 報告系統

| 報告類型 | 格式 | Native 存儲 | Connected 存儲 | 保留期 |
|---------|------|------------|---------------|--------|
| 執行報告 | JSON | $RUNNER_TEMP + artifact | Redis (604800s TTL) + artifact | 30 天 |
| 倉庫狀態 | JSON | $RUNNER_TEMP/repos/ | Redis key per repo | 24 小時 |
| 最終摘要 | Stdout | GitHub Actions log | GitHub Actions log | 永久 |

### 7.3 Provider-Agnostic 可觀測性矩陣

| 支柱 | Native 實作 | External 選項 |
|------|------------|---------------|
| **日誌** | JSONL → file + console | ELK / CloudWatch / Datadog |
| **指標** | 記憶體計數器 + 保留修剪 | Prometheus / CloudWatch / New Relic |
| **追蹤** | Span 樹 → 記憶體 + file | Jaeger / Zipkin / Datadog APM |
| **告警** | 閾值比對 → console + file | Slack / PagerDuty / Email |

---

## 8. 安全架構

### 8.1 Secrets 管理（Provider-Agnostic）

| 模式 | 存儲 | 加密方式 | 旋轉 | 審計 |
|------|------|---------|------|------|
| Native | 本地 AES-256-GCM 加密金庫 | 自動生成 master key | 手動 | 加密審計日誌 |
| Connected | GitHub Secrets / HashiCorp Vault | 平台託管 | 自動 | 外部審計系統 |
| Hybrid | 敏感用 Vault，其餘用 Native | 混合 | 按需 | 混合日誌 |

### 8.2 安全掃描（內建 13 模式）

```
Pattern Categories:
├── Cloud Credentials
│   ├── AWS Access Key ID (AKIA...)
│   └── AWS Secret Access Key
├── Platform Tokens
│   ├── GitHub Token (ghp_/gho_/ghs_/ghr_)
│   ├── GitHub Personal Access Token
│   └── Generic API Key
├── Cryptographic Material
│   ├── RSA Private Key
│   ├── EC Private Key
│   └── OpenSSH Private Key
├── Authentication
│   ├── Password patterns (password=, secret=)
│   └── JWT Token
└── Infrastructure
    ├── Database Connection String
    └── Generic Secret Assignment
```

### 8.3 Provider-Agnostic 合規性

- 所有 secrets 操作走 SecretsProvider 介面
- 審計日誌自動記錄（Native: 加密 JSONL，External: 外部系統）
- 作用域隔離（global / repository / environment / user）
- 檔案權限 0o600（Native Auth/Secrets Provider）

---

## 9. 部署模式

### 9.1 模式感知部署策略

| 步驟 | Native Mode | Connected Mode | Hybrid Mode |
|------|------------|----------------|-------------|
| 1. 安裝依賴 | npm install | npm install | npm install |
| 2. 構建 | npm run build | npm run build | npm run build |
| 3. 測試 | npm test | npm test | npm test |
| 4. 容器化 | ❌ (跳過) | Docker build + push | Docker build (if available) |
| 5. 部署 | 本地進程啟動 | Platform deploy (CF/Vercel/GKE) | 按可用性選擇 |
| 6. 驗證 | 本地 healthcheck | 平台 healthcheck | 混合 healthcheck |

### 9.2 零依賴啟動流程

```bash
# 完整平台啟動 — 零外部配置
git clone https://github.com/codexvanta-os/codexvanta-os-core-kernel.git
cd codexvanta-os-core-kernel
npm install
npm start

# 輸出:
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

## 10. 遷移指南（v1 → v2）

### 10.1 遷移步驟

| # | 步驟 | 操作 | 風險 |
|---|------|------|------|
| 1 | 重命名 Secrets | `REDIS_*` → `ORCH_STATE_*`, `GH_TOKEN` → `ORCH_GITHUB_TOKEN` | 低 |
| 2 | 部署 MANIFEST | 推送 25 個 REPO_MANIFEST.yaml | 低 |
| 3 | 更新 Orchestrator | 替換 orchestrator.yml 為 v2 | 中 |
| 4 | 更新 Runner | 替換 repository-runner.yml 為 v2 | 中 |
| 5 | 設置 Variables | 配置 `vars.ORCH_*_PROVIDER`（可選） | 低 |
| 6 | 測試 Native | 暫時移除所有可選 secrets | 低 |
| 7 | 啟用外部 | 逐一恢復外部服務 secrets | 低 |
| 8 | 驗證混合 | 確認 Hybrid 模式 failover | 低 |

### 10.2 向後兼容

- 已重命名的 `ORCH_*` secrets 在 Connected 模式下完全兼容
- 不設置 `ORCH_*_PROVIDER` → auto-detection（完全向後兼容）
- REPO_MANIFEST.yaml 缺失 → 降級驗證（非阻斷）
- 所有新 inputs 都有合理默認值

---

## 11. 變更歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| 1.0.0 | 2024-03-12 | 初始版本：硬綁定 Redis + GitHub API + Slack + Prometheus |
| 2.0.0 | 2024-03-13 | **架構轉型**: Native-first / Provider-agnostic。移除所有硬綁定。新增 Phase 0 模式偵測、Provider failover、模式感知部署、Provider-agnostic 驗證、12 Provider 全套支持。 |