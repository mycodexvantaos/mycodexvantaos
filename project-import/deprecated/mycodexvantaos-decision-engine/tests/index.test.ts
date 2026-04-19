import { RuleEngineService } from "../src/rule-engine";
import { RoutingService } from "../src/routing";

describe("RuleEngineService", () => {
  let engine: RuleEngineService;

  beforeEach(() => {
    engine = new RuleEngineService();
  });

  it("should add and retrieve a rule", () => {
    const rule = engine.addRule({
      name: "test-rule",
      condition: "env=production",
      action: "deploy",
      priority: 10,
      enabled: true,
    });
    expect(rule.id).toBeDefined();
    expect(engine.getRule(rule.id)).toEqual(rule);
  });

  it("should remove a rule", () => {
    const rule = engine.addRule({
      name: "r1",
      condition: "x=1",
      action: "a1",
      priority: 1,
      enabled: true,
    });
    expect(engine.removeRule(rule.id)).toBe(true);
    expect(engine.getRule(rule.id)).toBeNull();
  });

  it("should list rules sorted by priority desc", () => {
    engine.addRule({ name: "low", condition: "x=1", action: "a", priority: 1, enabled: true });
    engine.addRule({ name: "high", condition: "x=1", action: "b", priority: 99, enabled: true });
    engine.addRule({ name: "mid", condition: "x=1", action: "c", priority: 50, enabled: true });
    const list = engine.listRules();
    expect(list[0].name).toBe("high");
    expect(list[1].name).toBe("mid");
    expect(list[2].name).toBe("low");
  });

  it("should evaluate rules against context", () => {
    engine.addRule({ name: "match", condition: "env=staging", action: "scale-down", priority: 10, enabled: true });
    engine.addRule({ name: "no-match", condition: "env=production", action: "scale-up", priority: 20, enabled: true });
    const results = engine.evaluate({ env: "staging" });
    expect(results).toHaveLength(2);
    const matched = results.filter((r) => r.matched);
    expect(matched).toHaveLength(1);
    expect(matched[0].action).toBe("scale-down");
  });

  it("should return first matching rule with evaluateFirst", () => {
    engine.addRule({ name: "low-pri", condition: "region=us", action: "route-us", priority: 5, enabled: true });
    engine.addRule({ name: "high-pri", condition: "region=us", action: "route-us-fast", priority: 50, enabled: true });
    const result = engine.evaluateFirst({ region: "us" });
    expect(result).not.toBeNull();
    expect(result!.action).toBe("route-us-fast");
  });
});

describe("RoutingService", () => {
  let router: RoutingService;

  beforeEach(() => {
    router = new RoutingService();
  });

  it("should add and retrieve a route", () => {
    const route = router.addRoute({
      condition: "type=api",
      target: "api-cluster",
      priority: 10,
    });
    expect(route.id).toBeDefined();
    expect(router.getRoute(route.id)).toEqual(route);
  });

  it("should remove a route", () => {
    const route = router.addRoute({ condition: "x=1", target: "t", priority: 1 });
    expect(router.removeRoute(route.id)).toBe(true);
    expect(router.getRoute(route.id)).toBeNull();
  });

  it("should list routes sorted by priority desc", () => {
    router.addRoute({ condition: "a=1", target: "low", priority: 1 });
    router.addRoute({ condition: "a=1", target: "high", priority: 80 });
    const list = router.listRoutes();
    expect(list[0].target).toBe("high");
    expect(list[1].target).toBe("low");
  });

  it("should resolve first matching route", () => {
    router.addRoute({ condition: "region=eu", target: "eu-cluster", priority: 50 });
    router.addRoute({ condition: "region=us", target: "us-cluster", priority: 50 });
    const decision = router.resolve({ region: "eu" });
    expect(decision).not.toBeNull();
    expect(decision!.target).toBe("eu-cluster");
    expect(decision!.matchedRule).toBeDefined();
  });

  it("should return null when no route matches", () => {
    router.addRoute({ condition: "region=eu", target: "eu-cluster", priority: 50 });
    expect(router.resolve({ region: "ap" })).toBeNull();
  });

  it("should resolve all matching routes", () => {
    router.addRoute({ condition: "tier=premium", target: "fast-lane", priority: 90 });
    router.addRoute({ condition: "tier=premium", target: "backup-lane", priority: 10 });
    router.addRoute({ condition: "tier=free", target: "slow-lane", priority: 5 });
    const decisions = router.resolveAll({ tier: "premium" });
    expect(decisions).toHaveLength(2);
    expect(decisions[0].target).toBe("fast-lane");
    expect(decisions[1].target).toBe("backup-lane");
  });
});