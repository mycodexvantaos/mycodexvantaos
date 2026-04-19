import type { ComplianceReport, ComplianceViolation, Standard } from "./types";

let counter = 0;

export class ComplianceService {
  private standards = new Map<string, Standard>();

  registerStandard(name: string, version: string, rules: number): Standard {
    const id = `std-${++counter}`;
    const standard: Standard = { id, name, version, rules };
    this.standards.set(id, standard);
    return standard;
  }

  unregisterStandard(standardId: string): boolean {
    return this.standards.delete(standardId);
  }

  getStandard(standardId: string): Standard | null {
    return this.standards.get(standardId) ?? null;
  }

  listStandards(): Standard[] {
    return Array.from(this.standards.values());
  }

  check(standardId: string, resources: Record<string, unknown>[]): ComplianceReport {
    const standard = this.standards.get(standardId);
    if (!standard) {
      throw new Error(`Standard ${standardId} not found`);
    }

    const violations: ComplianceViolation[] = [];

    // SCAFFOLD: Hardcoded placeholder rules for demonstration.
    // TODO: Replace with configurable rule engine (external config or database).
    // Current rules: resource-ownership, resource-tagging
    for (const resource of resources) {
      const name = String(resource["name"] ?? "unknown");
      if (!resource["owner"]) {
        violations.push({
          rule: "resource-ownership",
          severity: "high",
          resource: name,
          message: `Resource "${name}" has no owner assigned`,
        });
      }
      if (!resource["tags"] || !Array.isArray(resource["tags"]) || (resource["tags"] as unknown[]).length === 0) {
        violations.push({
          rule: "resource-tagging",
          severity: "medium",
          resource: name,
          message: `Resource "${name}" missing required tags`,
        });
      }
    }

    const status: ComplianceReport["status"] =
      violations.length === 0 ? "compliant" :
      violations.some((v) => v.severity === "high") ? "non-compliant" : "partial";

    return {
      id: `report-${++counter}`,
      standard: standard.name,
      status,
      violations,
      checkedAt: new Date(),
    };
  }
}