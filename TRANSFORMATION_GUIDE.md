# MyCodexVantaOS 統一轉化指南

## 一、核心原則

### 1.1 平台獨立性（Platform Independence）

**基本要求：**
- 第三方平台服務、環境、AI API、KEY、TOKEN，是擴充出口，非成立地基
- 平台必須能在零外部依賴下存活（可降級，不可崩潰）
- 所有核心能力須具備 native 實作或明確禁止降級策略
- 所有模組必須可插拔，可離線運行，可移植

### 1.2 轉化目標

所有模組、元件、插件、工具、skill、adk、mcp、sdk 必須實現：
- **可獨立**：每個模組可單獨運行
- **可分離**：模組間解耦，可單獨部署
- **可組合**：模組可按需組合
- **可抽離**：可從系統中移除而不影響其他功能
- **可移植**：可在不同環境間遷移
- **可離線**：在無網路環境下可運行
- **可遷移**：數據和狀態可遷移

---

## 二、架構設計

### 2.1 四層架構

```
┌─────────────────────────────────────────────────────────────┐
│                     服務層                      │
│  mycodexvantaos-ai-ensemble, app-dev-studio, ...            │
├─────────────────────────────────────────────────────────────┤
│                     Provider 層                     │
│  Native Providers │ External Providers │ Hybrid Providers   │
├─────────────────────────────────────────────────────────────┤
│                     治理層                     │
│  Policy Engine │ Validation │ Compliance │ Enforcement      │
├─────────────────────────────────────────────────────────────┤
│                   部署層                    │
│  GitOps │ ArgoCD │ Kustomize │ Kubernetes                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 能力介面規範

所有能力必須實現 `CapabilityBase` 介面：

```typescript
interface CapabilityBase {
  readonly capabilityId: string;
  readonly capabilityName: string;
  readonly source: 'native' | 'external' | 'hybrid';
  readonly supportedModes: RuntimeMode[];
  
  initialize(): Promise<void>;
  healthCheck(): Promise<HealthCheckResult>;
  shutdown(): Promise<void>;
}
```

### 2.3 運行時模式

| 模式 | 說明 | 配置文件 |
|------|------|----------|
| `native` | 僅使用本地實現，零外部依賴 | `.env.native` |
| `connected` | 僅使用外部服務，需要網路 | `.env.connected` |
| `hybrid` | 優先外部，可降級到本地 | `.env.hybrid` |
| `auto` | 根據環境自動選擇 | `.env.local` |

---

## 三、Provider 實現規範

### 3.1 Native Provider

**特點：**
- 零外部依賴
- 可完全離線運行
- 使用本地資源（文件系統、內存、SQLite、IndexedDB）

**實現示例：**

```typescript
// providers/native/src/code-synthesis.ts
export class NativeCodeSynthesis implements CodeSynthesisCapability {
  readonly capabilityId = 'code-synthesis';
  readonly source = 'native';
  readonly supportedModes = ['native', 'hybrid', 'auto'];

  async generate(options: SynthesisOptions): Promise<SynthesisResult> {
    // 本地規則：模板匹配 + AST 變換（不調用任何 API）
    const suggestion = this.applyLocalTemplates(options.prompt, options.context);
    return { code: suggestion, confidence: 0.6, provider: 'native' };
  }
}
```

### 3.2 External Provider

**特點：**
- 調用第三方 API/服務
- 需要 API Key / Token
- 需要網路連接

**實現示例：**

```typescript
// providers/external/src/code-synthesis.ts
export class ExternalCodeSynthesis implements CodeSynthesisCapability {
  readonly source = 'external';
  
  constructor(private apiKey: string) {}

  async generate(options: SynthesisOptions): Promise<SynthesisResult> {
    const response = await callAnthropic(options.prompt, this.apiKey);
    return { code: response.completion, confidence: 0.95, provider: 'external' };
  }
}
```

### 3.3 Hybrid Provider

**特點：**
- 優先使用外部服務
- 失敗時降級到本地實現
- 最佳平衡方案

**實現示例：**

```typescript
// providers/hybrid/src/code-synthesis.ts
export class HybridCodeSynthesis implements CodeSynthesisCapability {
  readonly source = 'hybrid';
  
  constructor(
    private external: ExternalCodeSynthesis,
    private native: NativeCodeSynthesis
  ) {}

  async generate(options: SynthesisOptions): Promise<SynthesisResult> {
    try {
      return await this.external.generate(options);
    } catch (err) {
      console.warn('External AI failed, falling back to native', err);
      const result = await this.native.generate(options);
      return { ...result, fallbackTriggered: true };
    }
  }
}
```

---

## 四、模組轉化清單

### 4.1 已轉化模組

| 模組 | Native | External | Hybrid | 狀態 |
|------|--------|----------|--------|------|
| Framework Detection | ✅ | 🔄 | 🔄 | 進行中 |
| Code Synthesis | ✅ | 🔄 | 🔄 | 進行中 |
| Truth History | ✅ | 🔄 | 🔄 | 進行中 |
| Storage | 🔄 | 🔄 | 🔄 | 待開始 |
| Auth | 🔄 | 🔄 | 🔄 | 待開始 |
| Metrics | 🔄 | 🔄 | 🔄 | 待開始 |
| Logging | 🔄 | 🔄 | 🔄 | 待開始 |

### 4.2 待轉化模組

以下模組需要從直接調用 API 轉換為使用 Provider 介面：

1. **cross-framework/api-client.ts**
   - 當前：直接調用 Anthropic API
   - 目標：使用 `CodeSynthesisCapability` 介面

2. **cross-framework/zip-synthesis.ts**
   - 當前：直接依賴外部服務
   - 目標：使用 `ProviderFactory` 獲取 Provider

---

## 五、遷移步驟

### 5.1 現有模組遷移

**步驟 1：識別外部依賴**

```bash
# 查找直接 API 調用
grep -r "api.anthropic.com" --include="*.ts" --include="*.js"
grep -r "api.openai.com" --include="*.ts" --include="*.js"
```

**步驟 2：創建能力介面**

參考 `packages/capabilities/src/` 目錄下的介面定義。

**步驟 3：實現 Native Provider**

在 `providers/native/src/` 下實現零依賴版本。

**步驟 4：實現 External Provider**

在 `providers/external/src/` 下封裝原有 API 調用。

**步驟 5：實現 Hybrid Provider**

在 `providers/hybrid/src/` 下實現降級邏輯。

**步驟 6：更新業務代碼**

```typescript
// 原來錯誤的寫法 ❌
import { callClaudeAPI } from './api-client';
const result = await callClaudeAPI(apiKey, prompt);

// 現在正確的寫法 ✅
import { getProviderFactory } from '@mycodexvantaos/capabilities';
const factory = getProviderFactory();
const synthesis = await factory.getCodeSynthesisProvider();
const result = await synthesis.generate({ prompt });
```

### 5.2 新模組開發規範

1. **定義能力介面**
   - 在 `packages/capabilities/src/` 下創建介面
   - 繼承 `CapabilityBase`
   - 定義配置類型

2. **實現三種 Provider**
   - Native（必需）
   - External（可選）
   - Hybrid（可選）

3. **註冊到 Provider Factory**
   - 更新 `provider-factory.ts`

4. **編寫測試**
   - 測試 Native 模式離線運行
   - 測試 Hybrid 模式降級
   - 測試 Connected 模式錯誤處理

---

## 六、驗證清單

### 6.1 架構成立判據

- [ ] 平台可 local-first 成立：native 模式下所有核心能力有本地實現
- [ ] Provider 與 vendor 解耦：介面名不含 Claude/OpenAI
- [ ] 降級策略顯式：Hybrid Provider 有 try-catch + 結構化日誌
- [ ] 模式不漂移：啟動時解析一次，運行中不再改變
- [ ] CI 可阻斷：檢查 manifest 中 supportedModes 必須包含 native

### 6.2 測試矩陣

| 測試場景 | Native | Hybrid | Connected |
|----------|--------|--------|-----------|
| 離線運行 | ✅ 必須通過 | ✅ 必須通過 | ❌ 應該失敗 |
| 外部 API 可用 | N/A | 使用外部 | 使用外部 |
| 外部 API 不可用 | N/A | 降級到本地 | 啟動失敗 |
| 數據遷移 | ✅ | ✅ | ✅ |

---

## 七、目錄結構

```
mycodexvantaos/
├── packages/
│   └── capabilities/
│       └── src/
│           ├── base.ts                    # 基礎介面
│           ├── code-synthesis.ts          # 代碼合成介面
│           ├── framework-detection.ts     # 框架檢測介面
│           ├── truth-history.ts           # 真相歷史介面
│           ├── storage.ts                 # 存儲介面
│           ├── auth.ts                    # 認證介面
│           ├── metrics.ts                 # 指標介面
│           ├── logging.ts                 # 日誌介面
│           ├── provider-factory.ts        # Provider 工廠
│           ├── runtime-config.ts          # 運行時配置
│           └── index.ts                   # 統一導出
├── providers/
│   ├── native/
│   │   └── src/
│   │       ├── framework-detection.ts     # Native 框架檢測
│   │       ├── code-synthesis.ts          # Native 代碼合成
│   │       └── truth-history.ts           # Native 真相歷史
│   ├── external/
│   │   └── src/
│   │       └── ...                        # External Providers
│   └── hybrid/
│       └── src/
│           └── ...                        # Hybrid Providers
├── .env.native.example                    # Native 配置範例
├── .env.hybrid.example                    # Hybrid 配置範例
├── .env.connected.example                 # Connected 配置範例
└── TRANSFORMATION_GUIDE.md                # 本文檔
```

---

## 八、參考資料

- [Provider Abstraction Layer](./project-import/packages/core-kernel/src/abstraction/provider-abstraction-layer.ts)
- [Service Manifest Types](./project-import/packages/core-kernel/src/manifest/service-manifest.types.ts)
- [Governance Enforcer](./project-import/packages/core-kernel/src/governance/governance-enforcer.service.ts)