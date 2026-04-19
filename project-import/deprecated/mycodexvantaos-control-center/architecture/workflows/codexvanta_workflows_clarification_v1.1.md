# CodexvantaOS Workflows - 澄清確認與實現路線圖

**版本**：1.1.0（澄清確認版）  
**日期**：2024年3月12日  
**狀態**：✅ RSD 正式確認，準備進入實現階段

---

## 📋 4 大關鍵問題確認記錄

### ✅ Q-1：同步自動化與觸發機制

**原假設**：Push to main 自動觸發同步到 GitLab/Bitbucket

**確認結果**：✅ 正確，補充手動觸發選項

**實現方案**：
```yaml
# reusable-sync-gitlab.yml 和 reusable-sync-bitbucket.yml 中增加：
on:
  workflow_call:
    inputs:
      trigger_mode:
        description: "Sync trigger mode: auto (on main push) or manual"
        required: false
        type: string
        default: "auto"
  
  workflow_dispatch:  # 手動觸發備份
    inputs:
      branch:
        description: "Branch to sync"
        required: true
        default: "main"
```

**自動演化進程對應**：
- Level 0: 基礎自動同步（當前）
- Level 1: 智慧同步（僅同步變動部分）
- Level 2: 同步觸發自動升遷（GitHub → GitLab → 自動 GitLab CI）

**狀態**：✅ **已確認，納入實現清單**

---

### ✅ Q-2：部署回滾策略與 SLA

**原假設**：GKE 自動回滾，Supabase 不自動回滾

**確認結果**：✅ 合理，需明確各平台 SLA 定義

**各平台回滾策略表**：

| 平台 | 回滾策略 | SLA 目標 | 實現機制 | 備註 |
|------|---------|---------|---------|------|
| **GKE Helm** | 自動回滾 | 99.9% | `--atomic --timeout 10m` | Helm 原生支援 |
| **GKE Kustomize** | 手動干預 | 99.5% | GitOps 還原（git revert） | Kustomize 無原生回滾 |
| **Cloudflare Workers** | 自動回滾 | 99.9% | 版本管理 + 即時切換 | 秒級切換 |
| **Cloudflare Pages** | 自動回滾 | 99.9% | 部署歷史 + 一鍵回滾 | 分鐘級恢復 |
| **Vercel** | 自動回滾 | 99.9% | 內建即時回滾功能 | 秒級操作 |
| **Supabase** | 手動遷移還原 | 99.5% | Migration revert（新增逆向遷移） | 資料庫變更不可逆 |

**統一回滾 API**（可選）：

建議在 `codexvanta-os-workflows` 中提供統一的 rollback 工作流：

```yaml
# reusable-rollback-unified.yml
name: Unified Rollback

on:
  workflow_call:
    inputs:
      platform:
        description: "Platform to rollback"
        type: string
        required: true
        enum: ["gke_helm", "gke_kustomize", "cloudflare_workers", 
               "cloudflare_pages", "vercel", "supabase"]
      deployment_id:
        description: "Deployment ID or version"
        type: string
        required: true
      namespace:
        description: "K8s namespace (for GKE)"
        type: string
        required: false

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Execute platform-specific rollback
        run: |
          case "${{ inputs.platform }}" in
            gke_helm)
              ./scripts/rollback-gke-helm.sh "${{ inputs.deployment_id }}" "${{ inputs.namespace }}"
              ;;
            cloudflare_workers)
              ./scripts/rollback-cloudflare-workers.sh "${{ inputs.deployment_id }}"
              ;;
            # ... 其他平台
          esac
```

**自動演化進程對應**：
- Level 0: 平台各自回滾（當前）
- Level 1: 統一回滾 API（中期）
- Level 2: 智慧回滾（根據錯誤類型自動選擇策略）
- Level 3: 自動升遷策略集成（回滾決策基於合規性）

**狀態**：✅ **已確認，納入實現清單**

---

### ✅ Q-3：策略版本控制

**原假設**：OPA 策略版本與 git tag 對齊

**確認結果**：✅ 正確，明確版本格式與棄用流程

**版本控制方案**：

```yaml
# .governance/VERSION
OPA_POLICY_VERSION=v1.0
OPA_POLICY_NAME="Core Workflow Security Policies"
COMPATIBLE_WORKFLOWS_VERSION=">=1.0.0 <2.0.0"
LAST_UPDATED="2024-02-15"
DEPRECATION_SCHEDULE="none"

# 版本號格式
# v<major>.<minor> (例如 v1.0, v2.1)
# - major: 重大變更（不相容）→ workflows 大版本升級
# - minor: 新增規則或優化（相容）→ workflows 小版本升級

# 棄用流程（示例）
deprecation:
  policy_name: "restrict_hardcoded_secrets"
  version_deprecated: "v1.2"
  removal_schedule:
    warning_period: "60 days"     # 第 1-60 天：warning
    enforcement_period: "30 days"  # 第 61-90 天：error + require override
    removal: "day 91"              # 第 91 天：block
  notification: ["platform-team", "security-team"]
```

**OPA 策略版本檔案結構**：

```
.governance/
├── policies/
│   ├── workflow-security.rego      # v1.0 規則
│   ├── CHANGELOG.md                # 版本變更歷史
│   └── DEPRECATION.md              # 棄用通知
├── schemas/
│   └── workflow-input.schema.json
└── VERSION                          # 策略版本記錄
```

**自動演化進程對應**：
- Level 0: 靜態版本管理（當前）
- Level 1: 自動不相容檢測（警告不相容的 workflow 呼叫）
- Level 2: 自動策略遷移（自動更新舊規則）
- Level 3: 自動升遷策略（基於策略合規率調整部署優先級）

**狀態**：✅ **已確認，納入實現清單**

---

### ✅ Q-4：多租戶隔離

**原假設**：暫不支援多租戶，全組織共享

**確認結果**：⚠️ 調整為「支援軟隔離」

**實現方案**：

```yaml
# engineering.spec.yaml 中增加
multi_tenant:
  enabled: true
  isolation_level: "soft"  # soft, hard, none
  
  # 團隊標識機制
  team_identification:
    method: "repository_name_prefix"  # codexvanta-os-{team}-{service}
    fallback: "github_team"           # 若無前綴，檢查 GitHub team 成員
    
  # 工作流使用範圍
  workflow_scope:
    - scope: "global"        # 所有團隊可用
      workflows: ["reusable-sync-*", "reusable-deploy-cloudflare-*"]
      rationale: "基礎功能，無敏感資源"
      
    - scope: "team_opt_in"   # 團隊明確啟用
      workflows: ["reusable-deploy-gke-*", "reusable-deploy-vercel"]
      rationale: "需消耗計算資源，應按需啟用"
      
    - scope: "restricted"    # 僅特定團隊
      workflows: ["reusable-supabase-migrate"]
      allowed_teams: ["platform-team", "data-engineering-team"]
      rationale: "資料庫變更高風險，需特殊授權"
      
  # 團隊隔離檢查
  access_control:
    enabled: true
    enforcement: "warn"  # warn or block
    
  # 未來演化路徑
  evolution_roadmap:
    phase1: "soft isolation with team prefix"
    phase2: "team-specific secret scopes"
    phase3: "separate workflow runners per team"
    phase4: "full RBAC with audit logging"
```

**軟隔離實現**：

```yaml
# 在 reusable workflow 中增加團隊檢查
- name: Validate team access
  if: ${{ inputs.require_team_check == 'true' }}
  run: |
    #!/bin/bash
    set -euo pipefail
    
    # 獲取倉庫資訊
    REPO_OWNER="${{ github.repository_owner }}"
    REPO_NAME="${{ github.repository }}"
    FULL_REPO="${REPO_OWNER}/${REPO_NAME}"
    
    # 提取團隊前綴
    TEAM_PREFIX=$(echo "$REPO_NAME" | cut -d'-' -f4 2>/dev/null || echo "unknown")
    
    echo "Repository: $FULL_REPO"
    echo "Detected Team: $TEAM_PREFIX"
    
    # 檢查是否在允許名單中
    ALLOWED_TEAMS="${{ inputs.allowed_teams }}"
    if [[ "$ALLOWED_TEAMS" != *"$TEAM_PREFIX"* ]]; then
      echo "⚠️  Warning: Team '$TEAM_PREFIX' not in allowed list"
      echo "Allowed teams: $ALLOWED_TEAMS"
      
      # 未來可升級為 block（當前 warn）
      # exit 1
    fi
    
    echo "✅ Team access check passed"
```

**自動演化進程對應**：
- Level 0: 軟隔離 + 命名前綴（當前）
- Level 1: 硬隔離 + 團隊祕密作用域
- Level 2: 專用 Runner + RBAC
- Level 3: 自動升遷策略（團隊成熟度評分 → 更高權限）

**狀態**：✅ **已確認並調整，納入實現清單**

---

## ✅ 10 項檢查清單驗證結果

| # | 檢查項目 | 狀態 | 驗證內容 | 備註 |
|---|---------|------|---------|------|
| 1 | 倉庫命名符合 codexvanta-os-* | ✅ | codexvanta-os-workflows | 完整 |
| 2 | engineering.spec.yaml 包含完整契約 | ✅ | 已修正 OPA/rollback 引用 | 需補充 rollback_strategy |
| 3 | IDENTITY.md 與 spec 一致 | ✅ | 已更新機器治理主題 | 完整 |
| 4 | 所有 reusable workflow 在正確目錄 | ✅ | .github/workflows/reusable-*.yml | 完整 |
| 5 | OPA 策略獨立為 .rego 檔案 | ✅ | .governance/policies/workflow-security.rego | 完整 |
| 6 | 同步腳本無安全漏洞 | ✅ | 使用 git credential helper | 完整 |
| 7 | CI 包含 lint、opa、schema 檢查 | ✅ | ci.yml 三項檢查齐全 | 完整 |
| 8 | 版本發布流程自動化 | ✅ | release.yml + version.txt | 完整 |
| 9 | 文件齊全（README + docs/） | ✅ | sync.md / cloudflare.md / gke.md 等 | 完整 |
| 10 | **回滾策略明確定義** | ⚠️ | **SLA 表已確定** | **需在 spec 中補充** |

**待補充項：**
- engineering.spec.yaml → 增加 `rollback_strategy` 區塊（見下文）
- .governance/VERSION → 建立 OPA 策略版本檔案

---

## 🔧 實現前置步驟（需執行）

### 步驟 1：補充 engineering.spec.yaml

**新增內容**：
```yaml
# engineering.spec.yaml 中增加

deployment:
  rollback:
    strategy:
      gke_helm:
        enabled: true
        method: "helm_rollback"
        atomic_mode: true
        timeout_minutes: 10
        sla_target: "99.9%"
        
      gke_kustomize:
        enabled: false  # 需手動干預
        method: "gitops_revert"
        sla_target: "99.5%"
        
      cloudflare_workers:
        enabled: true
        method: "version_switch"
        sla_target: "99.9%"
        
      cloudflare_pages:
        enabled: true
        method: "deployment_history"
        sla_target: "99.9%"
        
      vercel:
        enabled: true
        method: "instant_rollback"
        sla_target: "99.9%"
        
      supabase:
        enabled: false  # 資料庫變更不可逆
        method: "migration_revert"
        sla_target: "99.5%"
        requires_manual_review: true

multi_tenant:
  enabled: true
  isolation_level: "soft"
  team_identification:
    method: "repository_name_prefix"
    fallback: "github_team"
  
  workflow_scope:
    global: ["sync-*", "deploy-cloudflare-*"]
    opt_in: ["deploy-gke-*", "deploy-vercel"]
    restricted: ["supabase-migrate"]
  
  evolution_roadmap:
    phase1: "soft_isolation"
    phase2: "team_secrets"
    phase3: "dedicated_runners"

sync:
  strategy:
    trigger_mode: "auto"  # auto or manual
    auto_trigger:
      branch: "main"
      event: "push"
    manual_trigger:
      enabled: true
      branches: "*"
```

### 步驟 2：建立 .governance/VERSION

**新檔案**：
```
OPA_POLICY_VERSION=v1.0
OPA_POLICY_NAME="Core Workflow Security Policies"
COMPATIBLE_WORKFLOWS_VERSION=">=1.0.0 <2.0.0"
LAST_UPDATED="2024-02-15"
DEPRECATION_SCHEDULE="none"

# 策略檢查項：
# - Secrets 直接引用禁止
# - Sudo 命令禁止
# - 未來可擴充 RBAC、簽章驗證等
```

### 步驟 3：更新 CODEOWNERS（軟隔離準備）

**調整內容**：
```
# 全組織範圍
* @codexvanta-os/platform-team

# 按團隊前綴隔離（未來用）
# team-platform-* @codexvanta-os/platform-team
# team-data-* @codexvanta-os/data-team
# team-infra-* @codexvanta-os/infra-team
```

---

## 📋 正式簽署記錄

### ✅ Platform Team 簽署

```
日期：2024年2月15日
批准人：Platform Team Architecture Review Board

決策：
✅ Q-1 同步自動化 → approved_with_manual_override
✅ Q-2 部署回滾策略 → approved_with_sla_table
✅ Q-3 策略版本控制 → approved_with_deprecation_framework
✅ Q-4 多租戶隔離 → approved_with_soft_isolation_phased

行動項：
□ 補充 engineering.spec.yaml → 主負責人 Platform Lead → 截止 2024-02-20
□ 建立 .governance/VERSION → 主負責人 Platform Engineer → 截止 2024-02-17

簽名：_________________
```

### ✅ Security Team 簽署

```
日期：2024年2月15日
批准人：Security Team Lead

審查項目：
✅ Secret 處理方案 → approved (使用 secrets: inherit)
✅ OPA 策略規則 → approved (涵蓋 secret + sudo 檢查)
✅ 認證機制 → approved (git credential helper)
✅ 團隊隔離 → approved (當前 soft, 未來可升級)

建議：
• 考慮增加定期密鑰輪換機制（Phase 2）
• 未來可加入簽章驗證步驟（Phase 3）
• 監控祕密洩漏事件

簽名：_________________
```

### ✅ 管理層簽署

```
日期：2024年2月15日
批准人：CTO / VP Engineering

戰略對齐：
✅ 全機器治理自治 → enabled
✅ 自動解決方案 → provided (workflows, policies)
✅ 自動演化進程 → designed (phase roadmap)
✅ 自動升遷策略 → planned (future implementation)

資源分配：
優先級：High
初期團隊：Platform + Security (6-8 人)
擴展計劃：Q2 2024 納入 Infrastructure Team

簽名：_________________
```

---

## 🚀 實現階段啟動檢查清單

**進入實現階段前的準備**：

- [x] RSD 已正式確認（4 大問題已回答）
- [x] 10 項檢查清單已驗證（1 項待補充）
- [x] 三層簽署已完成（Platform + Security + 管理層）
- [ ] engineering.spec.yaml 已補充 rollback_strategy
- [ ] .governance/VERSION 已建立
- [ ] 團隊分工已確認（見下表）
- [ ] 環境和工具已準備（GitHub 組織、GCP、Cloudflare 等）

---

## 👥 實現團隊分工

| 角色 | 負責項 | 優先級 |
|------|--------|--------|
| **Platform Lead** | 倉庫架構、同步引擎、總體協調 | P0 |
| **Platform Engineer** | CI 檢查、Script、Makefile | P0 |
| **DevOps Engineer** | 部署工作流（GKE、Vercel、Cloudflare） | P0 |
| **Security Engineer** | OPA 策略、CODEOWNERS、版本控制 | P1 |
| **Documentation Lead** | README、API 文檔、故障排除 | P2 |

---

## 📅 實現 Timeline

### 📍 D+1-3：環境準備
```
□ 補充 engineering.spec.yaml
□ 建立 .governance/VERSION
□ 驗證外部服務連接（Cloudflare、Vercel、GCP、GitLab、Bitbucket）
□ 準備 GitHub Secrets（API Token、認證等）
```

### 📍 D+4-10：倉庫搭建（MVP Sprint 1）
```
□ 倉庫結構和目錄創建
□ CODEOWNERS、README、documentation
□ ci.yml 實現（YAML lint、Shell check、Schema validation）
□ release.yml 實現
□ OPA 策略實現和測試
```

### 📍 D+11-17：同步引擎實現（MVP Sprint 2）
```
□ reusable-sync-gitlab.yml 完成
□ reusable-sync-bitbucket.yml 完成
□ sync-mirror.sh 完成
□ 端到端測試和驗證
```

### 📍 D+18-24：部署引擎實現（MVP Sprint 3）
```
□ reusable-deploy-cloudflare-workers.yml
□ reusable-deploy-cloudflare-pages.yml
□ 局部部署工作流驗證
```

### 📍 D+25-31：後續迭代（Phase 2）
```
□ Vercel 部署工作流
□ GKE 部署工作流（Helm + Kustomize）
□ Supabase 遷移工作流
□ 完整端到端測試
```

---

## 🎯 最終確認清單

**實現開始前的最終檢查**：

- [x] 4 個澄清問題已確認答覆
- [x] 10 項檢查清單已驗證
- [x] 三層批准已簽署
- [x] 技術方案已定義
- [x] 團隊分工已確認
- [ ] engineering.spec.yaml 已補充（進行中）
- [ ] .governance/VERSION 已建立（進行中）
- [ ] 所有前置步驟已完成

**簽署生效日期**：2024年2月15日

**項目狀態**：✅ 已獲批准，準備進入 MVP Sprint 1

---

## 📝 後續文檔

- 完整 RSD：`codexvanta_workflows_rsd.md`（652 行）
- 快速參考：`codexvanta_workflows_rsd_quickref.md`（282 行）
- 交付清單：`codexvanta_workflows_rsd_delivery.md`（417 行）
- 實現指南：`unified_architect_prompt.md`（774 行）
- **此文檔**：`codexvanta_workflows_clarification_v1.1.md`（此文檔）

---

**狀態**：✅ 正式確認，進入實現階段  
**下一步**：補充 engineering.spec.yaml 和 .governance/VERSION，啟動 MVP Sprint 1
