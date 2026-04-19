import { ComplianceService } from "../src/compliance";
import { RemediationService } from "../src/remediation";

describe("ComplianceService", () => {
  let svc: ComplianceService;

  beforeEach(() => {
    svc = new ComplianceService();
  });

  it("should register and retrieve a standard", () => {
    const std = svc.registerStandard("SOC2", "2.0", 50);
    expect(std.id).toBeDefined();
    expect(svc.getStandard(std.id)!.name).toBe("SOC2");
  });

  it("should unregister a standard", () => {
    const std = svc.registerStandard("ISO", "1.0", 20);
    expect(svc.unregisterStandard(std.id)).toBe(true);
    expect(svc.getStandard(std.id)).toBeNull();
  });

  it("should list standards", () => {
    svc.registerStandard("SOC2", "2.0", 50);
    svc.registerStandard("ISO27001", "1.0", 30);
    expect(svc.listStandards()).toHaveLength(2);
  });

  it("should return compliant when no violations", () => {
    const std = svc.registerStandard("test", "1.0", 5);
    const report = svc.check(std.id, [{ name: "svc-a", owner: "team-x", tags: ["prod"] }]);
    expect(report.status).toBe("compliant");
    expect(report.violations).toHaveLength(0);
  });

  it("should detect missing owner violation", () => {
    const std = svc.registerStandard("test", "1.0", 5);
    const report = svc.check(std.id, [{ name: "svc-a", tags: ["prod"] }]);
    expect(report.status).toBe("non-compliant");
    const ownerViolation = report.violations.find((v) => v.rule === "resource-ownership");
    expect(ownerViolation).toBeDefined();
  });

  it("should detect missing tags violation", () => {
    const std = svc.registerStandard("test", "1.0", 5);
    const report = svc.check(std.id, [{ name: "svc-a", owner: "team-x" }]);
    expect(report.violations.find((v) => v.rule === "resource-tagging")).toBeDefined();
  });

  it("should throw for unknown standard", () => {
    expect(() => svc.check("nonexistent", [])).toThrow();
  });
});

describe("RemediationService", () => {
  let svc: RemediationService;

  beforeEach(() => {
    svc = new RemediationService();
  });

  it("should register and retrieve an action", () => {
    const action = svc.registerAction({
      name: "fix-ownership",
      description: "Assign default owner",
      risk: "low",
      automatic: true,
    });
    expect(action.id).toBeDefined();
    expect(svc.getAction(action.id)!.name).toBe("fix-ownership");
  });

  it("should list actions by risk level", () => {
    svc.registerAction({ name: "a1", description: "d", risk: "low", automatic: true });
    svc.registerAction({ name: "a2", description: "d", risk: "high", automatic: false });
    svc.registerAction({ name: "a3", description: "d", risk: "low", automatic: true });
    expect(svc.listByRisk("low")).toHaveLength(2);
    expect(svc.listByRisk("high")).toHaveLength(1);
  });

  it("should return dry-run result", () => {
    const violations = [{ rule: "test", severity: "high", resource: "r", message: "m" }];
    const result = svc.remediate(violations, true);
    expect(result.status).toBe("dry-run");
    expect(result.actionsExecuted).toBe(0);
  });

  it("should execute automatic remediation", () => {
    svc.registerAction({ name: "resource-ownership", description: "fix owner", risk: "low", automatic: true });
    const violations = [{ rule: "resource-ownership", severity: "high", resource: "svc-a", message: "no owner" }];
    const result = svc.remediate(violations);
    expect(result.status).toBe("success");
    expect(result.actionsExecuted).toBe(1);
  });

  it("should report failure when no matching action", () => {
    const violations = [{ rule: "unknown-rule", severity: "high", resource: "r", message: "m" }];
    const result = svc.remediate(violations);
    expect(result.status).toBe("failure");
    expect(result.errors).toHaveLength(1);
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    const { bootstrap } = await import("../src/index");
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});