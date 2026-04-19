# CodexvantaOS 25倉庫全自動化同步多工作併發/並行流程實施指南

**版本**: 1.0.0  
**狀態**: Ready for Deployment  
**日期**: 2024-03-12

---

## 快速開始

### 前置條件

1. **GitHub 倉庫訪問權限**
   - 對所有 25 個倉庫的寫入權限
   - GitHub Personal Access Token (PAT) 或 App Token

2. **Redis 實例**
   - Redis 6.0+ 
   - 網絡連接（Docker 本地或雲服務）

3. **工具安裝**
   ```bash
   # GitHub CLI
   brew install gh  # macOS
   # 或
   sudo apt install gh  # Ubuntu
   
   # Python 3.11+
   python3 --version
   
   # Redis 客戶端
   redis-cli --version
   ```

### 30分鐘部署流程

#### 第一步：配置 Secrets (5分鐘)

```bash
# 進入工作流程倉庫
cd codexvanta-os-workflows

# 設置 GitHub Secrets
gh secret set ORCH_GITHUB_TOKEN --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')

# 設置 Redis Secrets
gh secret set ORCH_STATE_HOST --body "localhost" --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')
gh secret set ORCH_STATE_PORT --body "6379" --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')
gh secret set ORCH_STATE_PASSWORD --body "your-secure-password" --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')

# 驗證 Secrets
gh secret list --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')
```

#### 第二步：部署 Redis (5分鐘)

**選項 A：Docker（推薦用於測試）**

```bash
# 啟動 Redis
docker run -d \
  --name codexvanta-redis \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --requirepass your-secure-password

# 驗證連接
redis-cli -h localhost -p 6379 -a your-secure-password ping
```

**選項 B：雲服務（生產環境）**

**AWS ElastiCache:**
```bash
# 使用 AWS CLI
aws elasticache create-replication-group \
  --replication-group-id codexvanta-orchestration \
  --engine redis \
  --cache-node-type cache.t3.medium \
  --num-cache-clusters 1 \
  --replication-group-description "Codexvanta Orchestration State"
```

**Google Cloud Memorystore:**
```bash
# 使用 gcloud CLI
gcloud redis instances create codexvanta-orchestration \
  --region=us-central1 \
  --tier=basic \
  --memory-size-gb=1 \
  --redis-version=6
```

#### 第三步：推送工作流程 (3分鐘)

```bash
# 確保在正確的分支
git checkout main

# 提交所有更改
git add .
git commit -m "feat: implement complete automation flow for 25 repositories"

# 推送到 GitHub
git push origin main

# 驗證工作流程可見
gh workflow list --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')
```

#### 第四步：測試執行 (10分鐘)

```bash
# 運行試運行（dry run）
gh workflow run orchestrator.yml \
  --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||') \
  -f action=sync \
  -f scope=all \
  -f dry_run=true

# 獲取最新的執行 ID
RUN_ID=$(gh run list --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||') --limit 1 --json databaseId --jq '.[0].databaseId')

# 監控執行狀態
gh run watch $RUN_ID --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')

# 查看日誌
gh run view $RUN_ID --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||') --log
```

#### 第五步：驗證部署 (7分鐘)

```bash
# 檢查執行狀態
python3 codexvanta-os-control-center/scripts/orchestration/state-manager.py \
  --host localhost \
  --port 6379 \
  --password your-secure-password \
  test

# 查看執行進度
python3 codexvanta-os-control-center/scripts/orchestration/state-manager.py \
  --host localhost \
  --port 6379 \
  --password your-secure-password \
  get "orchestrator:*:progress"

# 生成監控儀表板
python3 codexvanta-os-control-center/scripts/orchestration/monitoring-dashboard.py \
  --execution-id latest
```

---

## 詳細配置

### 自動觸發配置

#### 計劃任務觸發

```yaml
# 在 orchestrator.yml 中配置
on:
  schedule:
    # 每日凌晨 2 點執行同步
    - cron: '0 2 * * *'  # UTC 02:00
    # 每週日 4 點執行完整部署
    - cron: '0 4 * * 0'  # UTC 04:00 Sunday
    # 每月 1 號 6 點執行健康檢查
    - cron: '0 6 1 * *'  # UTC 06:00 1st of month
```

#### 治理策略觸發

```bash
# 通過 GitHub API 觸發
curl -X POST \
  -H "Authorization: token $ORCH_GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/repos/codexvanta/codexvanta-os-workflows/dispatches \
  -d '{
    "event_type": "governance-trigger",
    "client_payload": {
      "policy_type": "security-policy",
      "action": "deploy",
      "scope": "all"
    }
  }'
```

### 併發優化配置

```yaml
# 在 queue-config.yaml 中調整
queues:
  control-plane:
    max_concurrent: 2  # 可以根據資源調整
  
  execution-plane:
    max_concurrent: 6  # 可以增加到 8-10 如果資源允許
  
  governance-plane:
    max_concurrent: 5  # 可以增加到 7-8

global_settings:
  max_global_concurrent: 20  # 全局最大併發度
  enable_adaptive_concurrency: true  # 啟用自適應併發
```

### 錯誤處理配置

```yaml
# 在 queue-config.yaml 中配置
retry_policy:
  max_retries: 3  # 最大重試次數
  initial_delay: 5  # 初始延遲（秒）
  backoff: exponential  # 退避策略
  max_delay: 300  # 最大延遲（秒）

rollback_strategy:
  enabled: true
  automatic: true  # 自動回滾
  timeout: 1800  # 回滾超時（秒）
```

---

## 監控和運維

### 實時監控

```bash
# 啟動實時監控儀表板
python3 codexvanta-os-control-center/scripts/orchestration/monitoring-dashboard.py \
  --execution-id latest \
  --refresh-interval 10
```

### 日誌查看

```bash
# 查看所有執行歷史
gh run list --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||') --limit 20

# 查看特定執行的詳細日誌
gh run view <run-id> --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||') --log

# 過濾失敗的執行
gh run list --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||') --status failure
```

### 性能指標

```bash
# 獲取執行統計
python3 codexvanta-os-control-center/scripts/orchestration/publish-metrics.py \
  --execution-id latest \
  --output-format json

# 查看資源使用情況
redis-cli -h localhost -p 6379 -a your-secure-password INFO stats
```

---

## 故障排除

### 常見問題

**問題 1：Redis 連接失敗**

```bash
# 檢查 Redis 是否運行
docker ps | grep redis

# 檢查 Redis 日誌
docker logs codexvanta-redis

# 測試連接
redis-cli -h localhost -p 6379 -a your-secure-password ping
```

**問題 2：GitHub Secrets 未配置**

```bash
# 列出所有 secrets
gh secret list --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')

# 重新設置缺失的 secret
gh secret set ORCH_STATE_PASSWORD --body "your-password" \
  --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')
```

**問題 3：工作流程未觸發**

```bash
# 檢查工作流程配置
gh workflow view orchestrator.yml --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||')

# 手動觸發測試
gh workflow run orchestrator.yml \
  --repo $(git remote get-url origin | sed 's|.*/||' | sed 's|\.git$||') \
  -f action=sync \
  -f scope=all
```

**問題 4：依賴解析失敗**

```bash
# 驗證依賴配置
python3 codexvanta-os-control-center/scripts/orchestration/validate-dependencies.py \
  --config codexvanta-os-control-center/registry/dependencies.yaml

# 查看詳細錯誤信息
python3 codexvanta-os-control-center/scripts/orchestration/validate-dependencies.py \
  --config codexvanta-os-control-center/registry/dependencies.yaml \
  --verbose
```

---

## 進階配置

### 自定義執行範圍

```bash
# 只執行特定平面
gh workflow run orchestrator.yml \
  -f action=deploy \
  -f scope=control-plane,governance-plane

# 執行自定義倉庫列表
gh workflow run orchestrator.yml \
  -f action=deploy \
  -f scope=custom \
  -f repositories="codexvanta-os-control-center,codexvanta-os-core-kernel,codexvanta-os-auth-service"
```

### 自定義併發度

```bash
# 臨時調整併發度
gh workflow run orchestrator.yml \
  -f action=deploy \
  -f scope=all \
  -f parallelism=10  # 覆蓋默認配置
```

### 強制執行

```bash
# 跳過依賴檢查（危險！）
gh workflow run orchestrator.yml \
  -f action=deploy \
  -f scope=all \
  -f force=true
```

---

## 安全最佳實踐

1. **Secret 管理**
   - 使用 GitHub Secrets 而不是硬編碼
   - 定期輪換 secrets
   - 使用最小權限原則

2. **訪問控制**
   - 限制誰可以觸發工作流程
   - 使用 protected branches
   - 啟用 required reviewers

3. **審計日誌**
   - 記錄所有執行
   - 保存失敗日誌
   - 定期審查權限

---

## 支持和文檔

- 完整設計文檔：`codexvanta-os-control-center/architecture/workflows/complete-automation-flow.md`
- 工作流程指南：`codexvanta-os-workflows/README.md`
- 治理策略：`codexvanta-os-control-center/governance/ORCHESTRATION_POLICY.md`

---

## 下一步

1. ✅ 完成快速開始步驟
2. 📊 設置監控和警報
3. 🔐 配置安全策略
4. 📚 培训團隊成員
5. 🚀 部署到生產環境

---

**部署狀態**: ✅ 準備就緒  
**預估部署時間**: 30 分鐘  
**支持狀態**: 🟢 活躍