/**
 * CodexvantaOS — ValidationProvider
 * 
 * Abstract interface for code / configuration / artifact validation.
 * Native mode: built-in linters, schema validators, checksum verifiers
 * External mode: SonarQube, CodeClimate, Snyk, custom CI checks, etc.
 * 
 * Covers: schema validation, code quality checks, dependency audits,
 *         configuration validation, artifact integrity verification.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info' | 'hint';

export type ValidationCategory =
  | 'schema'
  | 'lint'
  | 'security'
  | 'dependency'
  | 'config'
  | 'artifact'
  | 'convention'
  | 'custom';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  category: ValidationCategory;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  rule?: string;               // e.g. "no-unused-vars", "CVE-2024-XXXXX"
  suggestion?: string;         // auto-fix suggestion
  documentationUrl?: string;
}

export interface ValidationResult {
  valid: boolean;
  score?: number;              // 0–100 quality score if applicable
  issues: ValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
    hints: number;
  };
  duration: number;            // ms
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ValidationTarget {
  type: 'file' | 'directory' | 'repo' | 'config' | 'artifact' | 'schema' | 'url';
  path: string;               // file path, repo name, URL, etc.
  ref?: string;               // branch/tag for repo targets
  content?: string;           // inline content to validate (alternative to path)
}

export interface ValidationRuleSet {
  id: string;
  name: string;
  description?: string;
  categories: ValidationCategory[];
  rules: ValidationRule[];
  enabled: boolean;
}

export interface ValidationRule {
  id: string;
  name: string;
  severity: ValidationSeverity;
  category: ValidationCategory;
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface SchemaValidationInput {
  data: unknown;
  schema: Record<string, unknown>;   // JSON Schema, YAML schema, etc.
  format?: 'json-schema' | 'yaml-schema' | 'openapi' | 'custom';
}

export interface DependencyAuditResult {
  totalDependencies: number;
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  outdated: number;
  deprecated: number;
  issues: ValidationIssue[];
}

export interface ValidationHealth {
  healthy: boolean;
  mode: 'native' | 'external';
  provider: string;
  availableCategories: ValidationCategory[];
  ruleCount?: number;
  details?: Record<string, unknown>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ValidationProvider {
  readonly providerId: string;
  readonly mode: 'native' | 'external';

  /** Initialise provider, load rule sets. */
  init(): Promise<void>;

  // ── Core Validation ─────────────────────────────────────────────────────

  /** Run all applicable validations against a target. */
  validate(target: ValidationTarget, options?: {
    categories?: ValidationCategory[];
    severityThreshold?: ValidationSeverity;
    ruleSetIds?: string[];
    failFast?: boolean;
  }): Promise<ValidationResult>;

  /** Validate data against a schema definition. */
  validateSchema(input: SchemaValidationInput): Promise<ValidationResult>;

  // ── Dependency Audit ────────────────────────────────────────────────────

  /** Audit dependencies for vulnerabilities, outdated packages, deprecations. */
  auditDependencies(target: ValidationTarget): Promise<DependencyAuditResult>;

  // ── Rule Management ─────────────────────────────────────────────────────

  /** List available rule sets. */
  listRuleSets(): Promise<ValidationRuleSet[]>;

  /** Get a specific rule set by ID. */
  getRuleSet(ruleSetId: string): Promise<ValidationRuleSet | null>;

  /** Create or update a custom rule set. */
  upsertRuleSet?(ruleSet: ValidationRuleSet): Promise<ValidationRuleSet>;

  /** Enable or disable a specific rule within a rule set. */
  toggleRule?(ruleSetId: string, ruleId: string, enabled: boolean): Promise<void>;

  // ── Batch Validation ────────────────────────────────────────────────────

  /** Validate multiple targets in parallel. */
  validateBatch?(targets: ValidationTarget[], options?: {
    categories?: ValidationCategory[];
    concurrency?: number;
    stopOnFirstFailure?: boolean;
  }): Promise<Map<string, ValidationResult>>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  healthcheck(): Promise<ValidationHealth>;
  close(): Promise<void>;
}