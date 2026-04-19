/**
 * CodexvantaOS — Provider Interface Barrel Export
 *
 * All 12 abstract provider interfaces for the Native-first / Provider-agnostic architecture.
 */

// ── Core Data ─────────────────────────────────────────────
export * from "./database";
export * from "./storage";
export * from "./auth";
export * from "./queue";
export * from "./state-store";
export * from "./secrets";

// ── Platform Operations ───────────────────────────────────
export * from "./repo";
export * from "./deploy";
export * from "./validation";

// security has ScanOptions/ScanResult conflicting with state-store
// Use explicit re-exports to resolve ambiguity
export type { ScanType } from "./security";
export type { VulnerabilitySeverity, VulnerabilityState } from "./security";
export type { Vulnerability } from "./security";
export type { ScanTarget } from "./security";
export type { ScanOptions as SecurityScanOptions } from "./security";
export type { ScanResult as SecurityScanResult } from "./security";
export type { SBOMEntry, SBOMResult } from "./security";
export type { ComplianceRule, ComplianceResult } from "./security";
export type { SecurityHealth } from "./security";
export type { SecurityScannerProvider } from "./security";

// ── Observability & Communication ─────────────────────────
export * from "./observability";
export * from "./notification";

// ── Core Runtime Interfaces ───────────────────────────────────────────────────────
export * from "./runtime";