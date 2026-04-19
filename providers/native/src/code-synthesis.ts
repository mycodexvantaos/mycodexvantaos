/**
 * Native Code Synthesis Provider
 * 
 * 零外部依賴的代碼合成實現
 * 基於模板匹配 + AST 變換
 * 
 * 完全可離線運行，適用於本地開發環境
 */

import {
  CodeSynthesisCapability,
  SynthesisOptions,
  SynthesisResult,
  AnalysisOptions,
  AnalysisResult,
  HealthCheckResult,
} from '@mycodexvantaos/capabilities';

/**
 * 代碼模板
 */
interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  triggers: string[];
  template: string;
  variables: string[];
}

/**
 * 內建代碼模板
 */
const BUILTIN_TEMPLATES: CodeTemplate[] = [
  // React 組件
  {
    id: 'react-component',
    name: 'React Component',
    description: 'Basic React functional component',
    triggers: ['react component', 'component', 'functional component'],
    template: `import React from 'react';

interface {{componentName}}Props {
  // Add props here
}

export const {{componentName}}: React.FC<{{componentName}}Props> = (props) => {
  return (
    <div>
      {/* {{componentName}} content */}
    </div>
  );
};

export default {{componentName}};`,
    variables: ['componentName'],
  },
  // React Hook
  {
    id: 'react-hook',
    name: 'React Hook',
    description: 'Custom React hook',
    triggers: ['react hook', 'custom hook', 'hook'],
    template: `import { useState, useEffect } from 'react';

export function use{{hookName}}() {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Effect logic here
    return () => {
      // Cleanup logic here
    };
  }, []);

  return { state, setState };
}`,
    variables: ['hookName'],
  },
  // API Route
  {
    id: 'api-route',
    name: 'API Route',
    description: 'Express/Fastify API route',
    triggers: ['api route', 'endpoint', 'route', 'api'],
    template: `app.{{method}}('{{path}}', async (req, res) => {
  try {
    // Request handling logic
    const data = req.body;
    
    // Process data
    
    res.json({ success: true, data: null });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});`,
    variables: ['method', 'path'],
  },
  // TypeScript Interface
  {
    id: 'typescript-interface',
    name: 'TypeScript Interface',
    description: 'TypeScript interface definition',
    triggers: ['interface', 'type', 'typescript interface'],
    template: `export interface {{interfaceName}} {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  // Add additional properties here
}`,
    variables: ['interfaceName'],
  },
  // Class
  {
    id: 'typescript-class',
    name: 'TypeScript Class',
    description: 'TypeScript class definition',
    triggers: ['class', 'typescript class'],
    template: `export class {{className}} {
  private _property: any;

  constructor(initialValue?: any) {
    this._property = initialValue;
  }

  get property(): any {
    return this._property;
  }

  set property(value: any) {
    this._property = value;
  }

  public method(): void {
    // Method implementation
  }
}`,
    variables: ['className'],
  },
  // Test File
  {
    id: 'test-file',
    name: 'Test File',
    description: 'Unit test file',
    triggers: ['test', 'spec', 'unit test', 'jest test', 'vitest test'],
    template: `import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('{{testSubject}}', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should work correctly', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = input.toUpperCase();

    // Assert
    expect(result).toBe('TEST');
  });
});`,
    variables: ['testSubject'],
  },
  // Python Function
  {
    id: 'python-function',
    name: 'Python Function',
    description: 'Python function definition',
    triggers: ['python function', 'def', 'function python'],
    template: `def {{functionName}}(*args, **kwargs):
    """
    Description of the function.
    
    Args:
        *args: Positional arguments
        **kwargs: Keyword arguments
    
    Returns:
        Description of return value
    """
    # Implementation here
    pass`,
    variables: ['functionName'],
  },
  // Python Class
  {
    id: 'python-class',
    name: 'Python Class',
    description: 'Python class definition',
    triggers: ['python class', 'class python'],
    template: `class {{className}}:
    """
    Description of the class.
    """
    
    def __init__(self, *args, **kwargs):
        """Initialize the class."""
        pass
    
    def method(self):
        """A method."""
        pass`,
    variables: ['className'],
  },
  // SQL Query
  {
    id: 'sql-query',
    name: 'SQL Query',
    description: 'SQL SELECT query',
    triggers: ['sql', 'select', 'query', 'sql query'],
    template: `SELECT
  t.id,
  t.name,
  t.created_at,
  t.updated_at
FROM {{tableName}} t
WHERE t.deleted_at IS NULL
ORDER BY t.created_at DESC
LIMIT 100;`,
    variables: ['tableName'],
  },
  // Docker Compose
  {
    id: 'docker-compose',
    name: 'Docker Compose',
    description: 'Docker Compose service definition',
    triggers: ['docker', 'docker compose', 'compose', 'container'],
    template: `version: '3.8'

services:
  {{serviceName}}:
    build: .
    ports:
      - "{{port}}:{{port}}"
    environment:
      - NODE_ENV=development
    volumes:
      - .:/app
      - /app/node_modules
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:{{port}}/health"]
      interval: 30s
      timeout: 10s
      retries: 3`,
    variables: ['serviceName', 'port'],
  },
  // GitHub Actions
  {
    id: 'github-actions',
    name: 'GitHub Actions',
    description: 'GitHub Actions workflow',
    triggers: ['github actions', 'ci', 'workflow', 'github ci'],
    template: `name: {{workflowName}}

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build`,
    variables: ['workflowName'],
  },
];

/**
 * Native 代碼合成配置
 */
export interface NativeCodeSynthesisConfig {
  /**
   * 自定義模板
   */
  customTemplates?: CodeTemplate[];
  
  /**
   * 是否啟用內建模板
   */
  enableBuiltinTemplates?: boolean;
}

/**
 * Native 代碼合成實現
 */
export class NativeCodeSynthesis implements CodeSynthesisCapability {
  readonly capabilityId = 'code-synthesis' as const;
  readonly capabilityName = 'Code Synthesis';
  readonly source = 'native' as const;
  readonly supportedModes = ['native', 'hybrid', 'auto'] as const;

  private templates: CodeTemplate[];

  constructor(config: NativeCodeSynthesisConfig = {}) {
    const templates = config.enableBuiltinTemplates !== false ? [...BUILTIN_TEMPLATES] : [];
    this.templates = [...templates, ...(config.customTemplates || [])];
  }

  async initialize(): Promise<void> {
    // Native 實現無需特殊初始化
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return {
      status: 'healthy',
      latency: 0,
      message: 'Native code synthesis is always available',
      timestamp: new Date(),
    };
  }

  async shutdown(): Promise<void> {
    // 無需清理
  }

  /**
   * 生成代碼
   */
  async generate(options: SynthesisOptions): Promise<SynthesisResult> {
    const startTime = Date.now();
    const { prompt, context } = options;

    // 查找匹配的模板
    const template = this.findTemplate(prompt);
    
    if (template) {
      const code = this.applyTemplate(template, prompt, context);
      
      return {
        code,
        confidence: 0.7,
        provider: 'native',
        duration: Date.now() - startTime,
        metadata: {
          templateId: template.id,
          templateName: template.name,
        },
      };
    }

    // 無匹配模板，返回通用建議
    return {
      code: this.generateGenericCode(prompt, context),
      confidence: 0.4,
      provider: 'native',
      duration: Date.now() - startTime,
      metadata: {
        message: 'No specific template matched, generated generic code',
      },
    };
  }

  /**
   * 分析代碼
   */
  async analyze(options: AnalysisOptions): Promise<AnalysisResult> {
    const { code, analysisType } = options;
    const issues: AnalysisResult['issues'] = [];
    const suggestions: AnalysisResult['suggestions'] = [];

    // 基於正則的簡單分析
    const lines = code.split('\n');
    
    lines.forEach((line, index) => {
      // 檢查 console.log
      if (line.includes('console.log')) {
        issues.push({
          severity: 'warning',
          message: 'console.log found, consider removing in production',
          line: index + 1,
          ruleId: 'no-console-log',
        });
      }

      // 檢查 TODO
      if (line.includes('TODO') || line.includes('FIXME')) {
        issues.push({
          severity: 'info',
          message: 'TODO/FIXME comment found',
          line: index + 1,
          ruleId: 'todo-comment',
        });
      }

      // 檢查長行
      if (line.length > 120) {
        issues.push({
          severity: 'warning',
          message: 'Line exceeds 120 characters',
          line: index + 1,
          ruleId: 'max-line-length',
        });
      }

      // 檢查 any 類型
      if (line.includes(': any')) {
        issues.push({
          severity: 'warning',
          message: 'Use of any type, consider more specific type',
          line: index + 1,
          ruleId: 'no-explicit-any',
        });
      }
    });

    // 添加通用建議
    if (analysisType === 'quality') {
      suggestions.push({
        description: 'Consider adding unit tests for critical functionality',
        priority: 'medium',
      });
      suggestions.push({
        description: 'Ensure proper error handling is implemented',
        priority: 'high',
      });
    }

    if (analysisType === 'security') {
      suggestions.push({
        description: 'Review for potential security vulnerabilities',
        priority: 'high',
      });
      suggestions.push({
        description: 'Sanitize user inputs',
        priority: 'high',
      });
    }

    return {
      summary: `Analyzed ${lines.length} lines of code, found ${issues.length} issues`,
      issues,
      suggestions,
      provider: 'native',
      confidence: 0.6,
    };
  }

  /**
   * 重構代碼
   */
  async refactor(code: string, instructions: string): Promise<SynthesisResult> {
    // 簡單的重構實現
    let refactored = code;

    // 提取函數
    if (instructions.toLowerCase().includes('extract function') || instructions.toLowerCase().includes('extract method')) {
      refactored = this.extractFunction(code, instructions);
    }

    // 重命名
    if (instructions.toLowerCase().includes('rename')) {
      refactored = this.renameIdentifier(code, instructions);
    }

    return {
      code: refactored,
      confidence: 0.5,
      provider: 'native',
      metadata: {
        instructions,
        message: 'Native refactoring is limited. Consider using external AI for complex refactoring.',
      },
    };
  }

  /**
   * 解釋代碼
   */
  async explain(code: string): Promise<string> {
    // 基於模式的簡單解釋
    const patterns = [
      { pattern: /function\s+(\w+)/g, description: 'Defines a function named $1' },
      { pattern: /const\s+(\w+)\s*=/g, description: 'Declares a constant named $1' },
      { pattern: /class\s+(\w+)/g, description: 'Defines a class named $1' },
      { pattern: /import\s+.*from\s+['"](.+)['"]/g, description: 'Imports from $1' },
      { pattern: /export\s+(?:default\s+)?(\w+)/g, description: 'Exports $1' },
      { pattern: /async\s+function/g, description: 'Defines an asynchronous function' },
      { pattern: /await\s+/g, description: 'Waits for an asynchronous operation' },
    ];

    const explanations: string[] = ['This code:'];

    for (const { pattern, description } of patterns) {
      const matches = code.matchAll(pattern);
      for (const match of matches) {
        let desc = description;
        if (match[1]) {
          desc = desc.replace('$1', match[1]);
        }
        if (!explanations.includes(`- ${desc}`)) {
          explanations.push(`- ${desc}`);
        }
      }
    }

    if (explanations.length === 1) {
      explanations.push('- Contains code that performs operations');
      explanations.push('- For detailed explanation, consider using external AI');
    }

    return explanations.join('\n');
  }

  /**
   * 查找匹配的模板
   */
  private findTemplate(prompt: string): CodeTemplate | null {
    const lowerPrompt = prompt.toLowerCase();
    
    for (const template of this.templates) {
      for (const trigger of template.triggers) {
        if (lowerPrompt.includes(trigger)) {
          return template;
        }
      }
    }
    
    return null;
  }

  /**
   * 應用模板
   */
  private applyTemplate(
    template: CodeTemplate,
    prompt: string,
    context?: SynthesisOptions['context']
  ): string {
    let code = template.template;

    // 提取變量值
    const variableValues = this.extractVariables(prompt, template, context);

    // 替換變量
    for (const [key, value] of Object.entries(variableValues)) {
      code = code.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    return code;
  }

  /**
   * 從提示中提取變量值
   */
  private extractVariables(
    prompt: string,
    template: CodeTemplate,
    context?: SynthesisOptions['context']
  ): Record<string, string> {
    const values: Record<string, string> = {};

    // 默認值
    const defaults: Record<string, string> = {
      componentName: 'Component',
      hookName: 'Custom',
      method: 'get',
      path: '/api/endpoint',
      interfaceName: 'Data',
      className: 'Class',
      testSubject: 'Unit',
      functionName: 'function',
      tableName: 'table',
      serviceName: 'service',
      port: '3000',
      workflowName: 'CI',
    };

    for (const variable of template.variables) {
      // 嘗試從 prompt 中提取
      const patterns: Record<string, RegExp> = {
        componentName: /called\s+(\w+)|named\s+(\w+)|for\s+(\w+)/i,
        hookName: /called\s+(\w+)|named\s+(\w+)|use(\w+)/i,
        method: /(get|post|put|delete|patch)/i,
        path: /['"]\/[\w/]+['"]/,
        interfaceName: /for\s+(\w+)|called\s+(\w+)|named\s+(\w+)/i,
        className: /called\s+(\w+)|named\s+(\w+)/i,
        testSubject: /for\s+(\w+)|test(?:ing)?\s+(\w+)/i,
        functionName: /called\s+(\w+)|named\s+(\w+)/i,
        tableName: /from\s+(\w+)|table\s+(\w+)/i,
        serviceName: /for\s+(\w+)|called\s+(\w+)|named\s+(\w+)/i,
        port: /port\s+(\d+)/i,
        workflowName: /for\s+(\w+)|called\s+(\w+)|named\s+(\w+)/i,
      };

      const pattern = patterns[variable];
      if (pattern) {
        const match = prompt.match(pattern);
        if (match) {
          values[variable] = match[1] || match[2] || match[3] || defaults[variable];
        }
      }

      // 使用默認值
      if (!values[variable]) {
        values[variable] = defaults[variable] || 'value';
      }
    }

    return values;
  }

  /**
   * 生成通用代碼
   */
  private generateGenericCode(
    prompt: string,
    context?: SynthesisOptions['context']
  ): string {
    const language = context?.language || 'typescript';
    
    // 基於語言返回通用模板
    const genericTemplates: Record<string, string> = {
      typescript: `// Generated code for: ${prompt}
// Note: Native synthesis has limited capabilities.
// For better results, consider connecting to an external AI service.

export function generatedFunction() {
  // TODO: Implement based on requirements
  console.log('Generated from prompt: ${prompt}');
}`,
      python: `# Generated code for: ${prompt}
# Note: Native synthesis has limited capabilities.
# For better results, consider connecting to an external AI service.

def generated_function():
    """Generated from prompt: ${prompt}"""
    # TODO: Implement based on requirements
    pass`,
      javascript: `// Generated code for: ${prompt}
// Note: Native synthesis has limited capabilities.
// For better results, consider connecting to an external AI service.

function generatedFunction() {
  // TODO: Implement based on requirements
  console.log('Generated from prompt: ${prompt}');
}`,
    };

    return genericTemplates[language] || genericTemplates.typescript;
  }

  /**
   * 提取函數（簡化實現）
   */
  private extractFunction(code: string, instructions: string): string {
    // 非常簡化的實現
    const functionNameMatch = instructions.match(/named\s+(\w+)|called\s+(\w+)/i);
    const functionName = functionNameMatch?.[1] || functionNameMatch?.[2] || 'extractedFunction';

    return `// Extracted function
function ${functionName}() {
  // TODO: Move relevant code here
}

// Original code:
${code}`;
  }

  /**
   * 重命名標識符（簡化實現）
   */
  private renameIdentifier(code: string, instructions: string): string {
    const renameMatch = instructions.match(/rename\s+(\w+)\s+to\s+(\w+)/i);
    if (renameMatch) {
      const [, oldName, newName] = renameMatch;
      return code.replace(new RegExp(`\\b${oldName}\\b`, 'g'), newName);
    }
    return code;
  }
}

// 導出工廠函數
export function createNativeCodeSynthesis(config?: NativeCodeSynthesisConfig): CodeSynthesisCapability {
  return new NativeCodeSynthesis(config);
}