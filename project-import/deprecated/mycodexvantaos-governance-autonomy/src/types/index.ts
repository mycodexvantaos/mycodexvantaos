/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface ComplianceReport { id: string; standard: string; status: "compliant" | "non-compliant" | "partial"; violations: ComplianceViolation[]; checkedAt: Date; }

export interface ComplianceViolation { rule: string; severity: string; resource: string; message: string; }

export interface Standard { id: string; name: string; version: string; rules: number; }

export interface RemediationResult { id: string; status: "success" | "failure" | "partial" | "dry-run"; actionsExecuted: number; errors: string[]; }

export interface RemediationAction { id: string; name: string; description: string; risk: "low" | "medium" | "high"; automatic: boolean; }
