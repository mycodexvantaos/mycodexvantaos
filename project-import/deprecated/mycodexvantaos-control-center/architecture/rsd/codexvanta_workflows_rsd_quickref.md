# CodexvantaOS Workflows - RSD 快速參考指南

**版本**：1.0.0 | **狀態**：初稿待確認 | **日期**：2024年3月12日

---

## 📊 RSD 核心指標速查表

### 性能目標（P-Series）

```
┌─ 同步耗時      ≤ 5 分鐘    (100 MB 倉庫)
├─ 部署耗時      ≤ 3-10 分鐘 (Workers/Pages/GKE)
├─ CI 流水線     ≤ 5 分鐘    (Lint + Policy + Validation)
└─ 策略評估      ≤ 30 秒     (OPA Evaluation)
```

### 可靠性目標（R-Series）

```
┌─ 同步成功率    ≥ 99.5%
├─ 部署成功率    ≥ 99.0%
├─ 回滾成功率    ≥ 99.8%
├─ 策略攔截率    100%
└─ CI 檢查通過   100%
```

### 安全目標（S-Series）

```
┌─ 祕密洩漏      0 件/月
├─ 策略違規攔截  100%
├─ 依賴漏洞等級  ≤ Medium
├─ 日誌敏感信息  0 次/月
└─ 訪問控制      RBAC (CODEOWNERS)
```

---

## 🎯 核心功能模組清單

| # | 模組 | 核心工作流 | 優先級 | 狀態 |
|---|------|-----------|--------|------|
| 1 | **同步引擎** | reusable-sync-gitlab.yml<br>reusable-sync-bitbucket.yml | P0 | ✅ 設計完成 |
| 2 | **部署編排** | reusable-deploy-cloudflare-workers.yml<br>reusable-deploy-cloudflare-pages.yml<br>reusable-deploy-vercel.yml<br>reusable-deploy-gke-helm.yml<br>reusable-deploy-gke-kustomize.yml<br>reusable-supabase-migrate.yml | P0 | ✅ 設計完成 |
| 3 | **治理策略** | OPA 策略 + JSON Schema | P1 | ✅ 設計完成 |
| 4 | **本地 CI** | ci.yml + 各種驗證腳本 | P1 | ✅ 設計完成 |
| 5 | **文檔系統** | README + API + 故障排除 | P2 | ⏳ 待實現 |

---

## 📋 驗收標準矩陣（完整清單）

### 第一層：同步驗收（AC-SYNC-0xx）

| 編號 | 功能 | 預期結果 | 驗證方法 |
|------|------|---------|---------|
| AC-SYNC-001 | GitHub → GitLab 全量同步 | ✅ 所有分支/標籤/歷史同步<br>✅ 耗時 ≤ 5 分鐘<br>❌ 祕密未洩漏 | 測試同步後對比 git log |
| AC-SYNC-002 | GitHub → Bitbucket 全量同步 | ✅ 完整同步<br>✅ 耗時 ≤ 5 分鐘<br>✅ 自動重試 3 次 | 測試同步後驗證重試邏輯 |

### 第二層：部署驗收（AC-DEPLOY-0xx）

| 編號 | 功能 | 驗收標準 | 驗證方法 |
|------|------|---------|---------|
| AC-DEPLOY-001 | Workers 部署 | ✅ Prod/Preview 區分<br>✅ 耗時 ≤ 3 分鐘<br>✅ 失敗時詳細日誌 | 部署測試應用驗證 |
| AC-DEPLOY-002 | Pages 部署 | ✅ 執行構建<br>✅ 耗時 ≤ 5 分鐘<br>✅ 失敗時保留舊版本 | 部署靜態站點驗證 |
| AC-DEPLOY-003 | GKE Helm 部署 | ✅ Workload Identity 認證<br>✅ helm lint 驗證<br>✅ Pod 就緒檢查（10min timeout）<br>✅ 失敗自動回滾 | Helm 部署測試應用驗證 |
| AC-DEPLOY-004 | Supabase 遷移 | ✅ 遷移執行<br>❌ 失敗不自動回滾<br>✅ 歷史記錄保留 | 數據庫遷移測試驗證 |

### 第三層：治理驗收（AC-POLICY-0xx）

| 編號 | 功能 | 驗收標準 | 驗證方法 |
|------|------|---------|---------|
| AC-POLICY-001 | 祕密直接引用禁止 | 工作流被拒絕 + 友好提示 | 提交違規工作流驗證 |
| AC-POLICY-002 | 高風險操作禁止 | run: sudo 被攔截 | 提交包含 sudo 的工作流驗證 |
| AC-POLICY-003 | Schema 驗證 | 非法參數被拒絕 | 提交無效參數驗證 |

### 第四層：CI 驗收（AC-CI-0xx）

| 編號 | 功能 | 驗收標準 | 驗證方法 |
|------|------|---------|---------|
| AC-CI-001 | YAML 格式檢查 | yamllint 通過 | 提交格式錯誤的 YAML 驗證 |
| AC-CI-002 | Shell 語法檢查 | shellcheck 通過 | 提交語法錯誤的腳本驗證 |
| AC-CI-003 | Reusable workflow 驗證 | 結構檢查通過 | 提交缺少必要字段的工作流驗證 |

---

## 🔑 5 大關鍵假設

必須在開始實現前確認：

| # | 假設 | 檢查清單 | 確認人 |
|---|------|---------|--------|
| **A-001** | GitHub 組織已創建，Platform Team 有管理員權限 | [ ] 組織存在<br>[ ] 權限已配置 | ____ |
| **A-002** | GitLab/Bitbucket 帳戶已預先設置 | [ ] 帳戶已開通<br>[ ] 權限已配置 | ____ |
| **A-003** | 所有 API 令牌已安全存儲在 GitHub Secrets | [ ] Secrets 已配置<br>[ ] 令牌已驗證 | ____ |
| **A-004** | 外部服務網絡連接已驗證（延遲 <5s） | [ ] 連通性測試通過<br>[ ] 速率限制已評估 | ____ |
| **A-005** | Platform Team 維護此倉庫（3-5 人 24x7） | [ ] 人員已分配<br>[ ] 值班表已建立 | ____ |

---

## ⚠️ 6 個關鍵風險

| # | 風險 | 等級 | 概率 | 緩移措施 |
|---|------|------|------|---------|
| R-001 | 祕密洩漏到日誌 | 🔴 Critical | Medium | ✅ 使用 `::add-mask::`<br>✅ 月度日誌掃描 |
| R-002 | 跨平台同步不一致 | 🟠 High | Medium | ✅ 實現 checksum 驗證<br>✅ 1hr 驗證周期 |
| R-003 | Supabase 部署無法回滾 | 🟠 High | Low | ✅ 遷移指令冪等<br>✅ 手動回滾指南 |
| R-004 | 策略與代碼版本不同步 | 🟡 Medium | Medium | ✅ 漸進式策略發佈<br>✅ 2 周提前通知 |
| R-005 | 外部 API 限流 | 🟡 Medium | Low | ✅ 指數退避重試<br>✅ 速率監控 |
| R-006 | Workload Identity 配置錯誤 | 🟠 High | Medium | ✅ 配置驗證腳本<br>✅ 詳細文檔 |

---

## 🛠️ 技術棧一覽表

### 核心工具鏈

```
Orchestration     → GitHub Actions v4
Policy Engine     → OPA v0.65+
Schema Validation → JSON Schema draft-07 + ajv-cli
Git Operations    → git CLI 2.40+
Deployment Tools  → Wrangler 3.26+ / Vercel CLI 39.2+ / 
                    kubectl 1.27+ / Helm 3.13+ / Supabase CLI 1.146+
Secret Management → GitHub Secrets (內置)
```

### 支持工具

```
YAML 檢查    → yamllint 1.35+
Shell 檢查   → shellcheck 0.10+
JSON 驗證    → ajv-cli 5.0+
JSON 處理    → jq 1.7+
HTTP 請求    → curl 8.0+
GCP CLI      → gcloud 600+
```

---

## 💡 5 大技術決策（ADR 摘要）

| # | 決策 | 為何選擇 | 後續評估 |
|---|------|---------|---------|
| **ADR-001** | OPA 而非其他策略引擎 | 語言通用性、CI/CD 成熟度、社區支持 | OPA 性能 >30s 時考慮轉向編譯型語言 |
| **ADR-002** | 多個部署工具而非統一抽象 | 最新特性、最小依賴、直接控制 | 新增平台 >5 個時重新考慮統一層 |
| **ADR-003** | GitHub Secrets 而非外部管理 | 簡單、零成本、無額外維護 | 同步倉庫 >20 個時遷移到 secret-vault |
| **ADR-004** | 同步到 GitLab + Bitbucket | 企業現實、代碼備份、未來擴展 | 定期檢查同步完整性和一致性 |
| **ADR-005** | Helm + Kustomize 雙軌 | 生態靈活性、選擇自由、降低遷移成本 | 確定標準化方向，未來逐步合併 |

---

## ❓ 4 個待澄清的關鍵問題

**在進入設計階段前必須確認**：

### Q-1: 同步自動化與觸發機制？
```
目前假設：Push to main 自動觸發，保留完整歷史
需確認：
  □ 是否正確？
  □ 是否需手動觸發选项？
  □ 是否支持增量同步？
```

### Q-2: 回滾策略與 SLA？
```
目前假設：
  - GKE Helm: 自動回滾到前一版本
  - Supabase: 不自動回滾，需手動
需確認：
  □ 各平台的回滾 SLA 是什麼？
  □ 統一回滾 API 必要嗎？
  □ 回滾失敗時的升級流程？
```

### Q-3: 策略版本控制？
```
目前假設：OPA 策略版本號與 git tag 對齊
需確認：
  □ 新增策略時是否需版本號？
  □ 策略棄用流程是什麼？
  □ 是否支持策略 A/B 測試？
```

### Q-4: 多租戶隔離需求？
```
目前假設：暫不支持，全組織共享
需確認：
  □ 是否需要 team-level workflows？
  □ 各 team 是否需獨立策略？
  □ 跨 team 工作流共享如何管理？
```

---

## 📅 MVP 交付計畫（2 周 Sprint）

### 第 1 周：基礎設施 + 同步引擎

```
□ 倉庫架構搭建（目錄結構、CODEOWNERS）
□ CI 本地檢查實現（yamllint、shellcheck）
□ 同步到 GitLab 工作流（含祕密管理）
□ 同步到 Bitbucket 工作流（含祕密管理）
□ 同步完整性驗證腳本
```

### 第 2 周：部署引擎 + 驗證

```
□ Cloudflare Workers 部署工作流
□ Cloudflare Pages 部署工作流
□ Schema 驗證框架搭建
□ 本地測試環境（模擬 CI/CD 流程）
□ README + 快速開始指南
```

### 後續迭代（第 3-4 周）

```
□ Vercel 部署工作流
□ GKE Helm 部署工作流
□ GKE Kustomize 部署工作流
□ OPA 策略引擎完整化
□ Supabase 數據庫遷移工作流
```

---

## ✅ RSD 簽署清單

**此 RSD 已完成的部分**：

- ✅ 功能描述（精確定義，無歧義）
- ✅ 驗收標準（12 個 AC，全覆蓋）
- ✅ 非功能性指標（4 個維度，全量化）
- ✅ 假設條件（10 個，全明確）
- ✅ 技術棧選擇（含版本範圍、理由）
- ✅ 風險評估（6 個風險，全緩移）
- ✅ 技術決策（5 個 ADR，含後續評估）
- ✅ MVP 計畫（優先級清晰）

**待確認的部分**：

- ⏳ 澄清 4 個關鍵問題
- ⏳ 簽署 5 個關鍵假設檢查清單
- ⏳ Platform Team + Security Team 簽署

---

## 📞 簽署與審批

| 角色 | 簽署人 | 簽名 | 日期 | 備註 |
|------|--------|------|------|------|
| Platform Team Lead | | _____ | ____ | 推進實現 |
| Security Team Lead | | _____ | ____ | 安全設計確認 |
| Engineering Manager | | _____ | ____ | 優先級和交付計畫確認 |

---

## 📚 相關文檔

| 文檔 | 連結 | 用途 |
|------|------|------|
| **完整 RSD** | `codexvanta_workflows_rsd.md` | 正式審批和存檔 |
| **倉庫規劃** | 上傳的規劃文件 | 背景和需求來源 |
| **形式化架構師提示詞** | `unified_architect_prompt.md` | 開發流程和標準 |

---

**下一步行動**：

1. ✋ **暫停**：將此 RSD 提交給 Platform Team + Security Team 審批
2. 📋 **確認**：回答上述 4 個澄清問題
3. ✅ **簽署**：完成 3 人簽署
4. 🚀 **推進**：進入「技術方案設計」階段

---

**生成時間**：2024年3月12日 | **版本**：1.0.0 | **狀態**：初稿待確認
