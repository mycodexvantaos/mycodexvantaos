import { PolicyService } from "../src";

describe("PolicyService", () => {
  let svc: PolicyService;

  beforeEach(() => {
    svc = new PolicyService();
  });

  it("should create a policy", () => {
    const policy = svc.create({
      name: "no-root-deploy",
      rules: [{ field: "user", operator: "eq", value: "root", action: "deny" }],
      enabled: true,
      priority: 10,
      scope: "global",
    });
    expect(policy.id).toBeDefined();
    expect(policy.name).toBe("no-root-deploy");
  });

  it("should get a policy by id", () => {
    const created = svc.create({
      name: "test",
      rules: [],
      enabled: true,
      priority: 1,
      scope: "global",
    });
    expect(svc.get(created.id)).toEqual(created);
  });

  it("should delete a policy", () => {
    const p = svc.create({ name: "del", rules: [], enabled: true, priority: 1, scope: "global" });
    expect(svc.delete(p.id)).toBe(true);
    expect(svc.get(p.id)).toBeUndefined();
  });

  it("should list policies sorted by priority", () => {
    svc.create({ name: "low", rules: [], enabled: true, priority: 1, scope: "global" });
    svc.create({ name: "high", rules: [], enabled: true, priority: 100, scope: "global" });
    const list = svc.list();
    expect(list[0].name).toBe("high");
    expect(list[1].name).toBe("low");
  });

  it("should filter by scope", () => {
    svc.create({ name: "g", rules: [], enabled: true, priority: 1, scope: "global" });
    svc.create({ name: "s", rules: [], enabled: true, priority: 1, scope: "service" });
    expect(svc.list("global")).toHaveLength(1);
    expect(svc.list("service")).toHaveLength(1);
  });

  it("should evaluate eq rule correctly", () => {
    svc.create({
      name: "block-root",
      rules: [{ field: "user", operator: "eq", value: "root", action: "deny" }],
      enabled: true,
      priority: 10,
      scope: "global",
    });
    const results = svc.evaluate({ user: "root" });
    expect(results).toHaveLength(1);
    expect(results[0].matched).toBe(true);
    expect(results[0].action).toBe("deny");
  });

  it("should evaluate gt rule correctly", () => {
    svc.create({
      name: "large-payload",
      rules: [{ field: "size", operator: "gt", value: 1000, action: "warn" }],
      enabled: true,
      priority: 5,
      scope: "global",
    });
    const r1 = svc.evaluate({ size: 2000 });
    expect(r1[0].matched).toBe(true);
    const r2 = svc.evaluate({ size: 500 });
    expect(r2[0].matched).toBe(false);
  });

  it("should skip disabled policies", () => {
    svc.create({
      name: "disabled",
      rules: [{ field: "x", operator: "eq", value: 1, action: "deny" }],
      enabled: false,
      priority: 1,
      scope: "global",
    });
    const results = svc.evaluate({ x: 1 });
    expect(results).toHaveLength(0);
  });
});
