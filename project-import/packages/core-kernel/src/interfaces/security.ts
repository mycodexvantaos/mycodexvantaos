/**
 * CodexvantaOS — SecurityScannerProvider
 * 
 * Abstract interface for security scanning and vulnerability management.
 * Native mode: built-in pattern matchers, secret detectors, SBOM generators
 * External mode: Snyk, Trivy, SonarQube, GitHub Advanced Security,
 *                Checkmarx, OWASP ZAP, etc.
 * 
 * Covers: SAST, DAST (optional), secret detection, container scanning,
 *         SBOM generation, compliance checks, vulnerability tracking.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScanType =
  | 'sast'            // Static Application Security Testing
  | 'secret'          // Secret / credential detection
  | 'dependency'      // Known CVE in dependencies
  | 'container'       // Container image scanning
  | 'iac'             // Infrastructure-as-Code scanning
  | 'license'         // License compliance
  | 'dast'            // Dynamic Application Security Testing
  | 'custom';

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low' | 'informational';

export type VulnerabilityState = 'open' | 'confirmed' | 'in_progress' | 'resolved' | 'dismissed' | 'false_positive';

export interface Vulnerability {
  id: string;
  cve?: string;                 // CVE identifier if applicable
  cwe?: string;                 // CWE category
  title: string;
  description: string;
  severity: VulnerabilitySeverity;
  state: VulnerabilityState;
  scanType: ScanType;
  file?: string;
  line?: number;
  column?: number;
  package?: string;             // affected package name
  installedVersion?: string;
  fixedVersion?: string;        // version that fixes the issue
  exploitAvailable?: boolean;
  cvssScore?: number;           // 0.0 – 10.0
  references?: string[];        // URLs to advisories
  remediation?: string;         // suggested fix
  firstDetected: number;        // epoch ms
  lastSeen: number;
  metadata?: Record<string, unknown>;
}

export interface ScanTarget {
  type: 'directory' | 'repository' | 'image' | 'url' | 'file';
  path: string;                 // local path, repo name, image ref, URL
  ref?: string;                 // branch / tag for repos
}

export interface ScanOptions {
  scanTypes?: ScanType[];
  severityThreshold?: VulnerabilitySeverity;  // only report ≥ this level
  ignorePaths?: string[];
  ignoreIds?: string[];          // suppress known false positives
  failOnSeverity?: VulnerabilitySeverity;     // fail the scan if ≥ this found
  timeout?: number;              // seconds
  incremental?: boolean;         // only scan changed files if supported
}

export interface ScanResult {
  scanId: string;
  target: ScanTarget;
  scanTypes: ScanType[];
  status: 'completed' | 'failed' | 'partial';
  vulnerabilities: Vulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    informational: number;
    total: number;
  };
  passed: boolean;               // true if no vuln ≥ failOnSeverity
  duration: number;              // ms
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface SBOMEntry {
  name: string;
  version: string;
  type: 'npm' | 'pip' | 'go' | 'maven' | 'cargo' | 'system' | 'other';
  license?: string;
  directDependency: boolean;
  checksum?: string;
}

export interface SBOMResult {
  format: 'spdx' | 'cyclonedx' | 'custom';
  entries: SBOMEntry[];
  generatedAt: number;
  target: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  framework: string;            // e.g. 'SOC2', 'HIPAA', 'PCI-DSS', 'internal'
  description: string;
  requirement: string;
  severity: VulnerabilitySeverity;
}

export interface ComplianceResult {
  framework: string;
  rules: Array<ComplianceRule & { passed: boolean; evidence?: string }>;
  overallPassed: boolean;
  passRate: number;              // 0–100
  timestamp: number;
}

export interface SecurityHealth {
  healthy: boolean;
  mode: 'native' | 'external';
  provider: string;
  supportedScanTypes: ScanType[];
  lastScanAt?: number;
  openVulnerabilities?: number;
  details?: Record<string, unknown>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface SecurityScannerProvider {
  readonly providerId: string;
  readonly mode: 'native' | 'external';

  /** Initialise scanner engine / connection. */
  init(): Promise<void>;

  // ── Scanning ────────────────────────────────────────────────────────────

  /** Run security scans against a target. */
  scan(target: ScanTarget, options?: ScanOptions): Promise<ScanResult>;

  /** Run scans on multiple targets in parallel. */
  scanBatch?(targets: ScanTarget[], options?: ScanOptions & { concurrency?: number }): Promise<ScanResult[]>;

  // ── Vulnerability Management ────────────────────────────────────────────

  /** List known vulnerabilities, optionally filtered. */
  listVulnerabilities(options?: {
    state?: VulnerabilityState;
    severity?: VulnerabilitySeverity;
    scanType?: ScanType;
    since?: number;
    limit?: number;
  }): Promise<Vulnerability[]>;

  /** Update the state of a vulnerability (triage). */
  updateVulnerability(vulnId: string, update: {
    state?: VulnerabilityState;
    notes?: string;
    assignee?: string;
  }): Promise<Vulnerability>;

  // ── SBOM ────────────────────────────────────────────────────────────────

  /** Generate a Software Bill of Materials. */
  generateSBOM?(target: ScanTarget, format?: 'spdx' | 'cyclonedx'): Promise<SBOMResult>;

  // ── Compliance ──────────────────────────────────────────────────────────

  /** Run compliance checks against a framework. */
  checkCompliance?(target: ScanTarget, framework: string): Promise<ComplianceResult>;

  /** List available compliance frameworks. */
  listComplianceFrameworks?(): Promise<string[]>;

  // ── Secret Detection ────────────────────────────────────────────────────

  /** Dedicated secret detection scan (convenience wrapper over scan with type='secret'). */
  detectSecrets?(target: ScanTarget): Promise<Vulnerability[]>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  healthcheck(): Promise<SecurityHealth>;
  close(): Promise<void>;
}