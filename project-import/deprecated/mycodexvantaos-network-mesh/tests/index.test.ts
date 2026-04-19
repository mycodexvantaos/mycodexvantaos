import { ServiceDiscoveryService } from "../src/service-discovery";
import { LoadBalancerService } from "../src/load-balancer";
import { GatewayService } from "../src/gateway";

describe("ServiceDiscoveryService", () => {
  let discovery: ServiceDiscoveryService;

  beforeEach(() => {
    discovery = new ServiceDiscoveryService();
  });

  it("should register and retrieve an instance", () => {
    const inst = discovery.register({
      name: "api",
      host: "10.0.0.1",
      port: 8080,
      metadata: { version: "1.0" },
    });
    expect(inst.id).toBeDefined();
    expect(inst.healthy).toBe(true);
    expect(discovery.getInstance(inst.id)).toEqual(inst);
  });

  it("should deregister an instance", () => {
    const inst = discovery.register({ name: "api", host: "10.0.0.1", port: 8080, metadata: {} });
    expect(discovery.deregister(inst.id)).toBe(true);
    expect(discovery.getInstance(inst.id)).toBeNull();
  });

  it("should discover only healthy instances by name", () => {
    const a = discovery.register({ name: "api", host: "10.0.0.1", port: 8080, metadata: {} });
    discovery.register({ name: "api", host: "10.0.0.2", port: 8080, metadata: {} });
    discovery.register({ name: "web", host: "10.0.0.3", port: 3000, metadata: {} });
    discovery.markUnhealthy(a.id);
    const found = discovery.discover("api");
    expect(found).toHaveLength(1);
    expect(found[0].host).toBe("10.0.0.2");
  });

  it("should report health check summary", () => {
    discovery.register({ name: "a", host: "h1", port: 1, metadata: {} });
    const b = discovery.register({ name: "b", host: "h2", port: 2, metadata: {} });
    discovery.markUnhealthy(b.id);
    const check = discovery.healthCheck();
    expect(check).toEqual({ total: 2, healthy: 1, unhealthy: 1 });
  });
});

describe("LoadBalancerService", () => {
  let lb: LoadBalancerService;
  const instances = [
    { id: "s1", name: "api", host: "h1", port: 1, healthy: true, metadata: {} },
    { id: "s2", name: "api", host: "h2", port: 2, healthy: true, metadata: {} },
    { id: "s3", name: "api", host: "h3", port: 3, healthy: false, metadata: {} },
  ];

  beforeEach(() => {
    lb = new LoadBalancerService();
  });

  it("should default to round-robin strategy", () => {
    expect(lb.getStrategy()).toBe("round-robin");
  });

  it("should round-robin through healthy instances", () => {
    const first = lb.select(instances);
    const second = lb.select(instances);
    expect(first!.id).toBe("s1");
    expect(second!.id).toBe("s2");
  });

  it("should return null when no healthy instances", () => {
    const unhealthy = instances.map((i) => ({ ...i, healthy: false }));
    expect(lb.select(unhealthy)).toBeNull();
  });

  it("should select least-connections instance", () => {
    lb.setStrategy("least-connections");
    lb.recordConnection("s1");
    lb.recordConnection("s1");
    lb.recordConnection("s2");
    const selected = lb.select(instances);
    // s3 is unhealthy so skip; s2 has 1 conn vs s1 has 2
    expect(selected!.id).toBe("s2");
  });

  it("should track and release connections", () => {
    lb.recordConnection("s1");
    lb.recordConnection("s1");
    lb.releaseConnection("s1");
    const counts = lb.getConnectionCounts();
    const s1 = counts.find((c) => c.instanceId === "s1");
    expect(s1!.count).toBe(1);
  });
});

describe("GatewayService", () => {
  let gw: GatewayService;

  beforeEach(() => {
    gw = new GatewayService();
  });

  it("should add and retrieve a route", () => {
    const id = gw.addRoute({ path: "/api", method: "GET", target: "api-svc", middleware: [] });
    expect(id).toBeDefined();
    const route = gw.getRoute(id);
    expect(route).not.toBeNull();
    expect(route!.target).toBe("api-svc");
  });

  it("should remove a route", () => {
    const id = gw.addRoute({ path: "/x", method: "POST", target: "t", middleware: [] });
    expect(gw.removeRoute(id)).toBe(true);
    expect(gw.getRoute(id)).toBeNull();
  });

  it("should match exact path and method", () => {
    gw.addRoute({ path: "/api/v1", method: "GET", target: "v1-svc", middleware: ["auth"] });
    gw.addRoute({ path: "/api/v2", method: "POST", target: "v2-svc", middleware: [] });
    const resp = gw.handle("/api/v1", "GET");
    expect(resp.statusCode).toBe(200);
    expect((resp.body as Record<string, unknown>).target).toBe("v1-svc");
  });

  it("should return 404 for unmatched routes", () => {
    const resp = gw.handle("/unknown", "GET");
    expect(resp.statusCode).toBe(404);
  });

  it("should list all routes", () => {
    gw.addRoute({ path: "/a", method: "GET", target: "t1", middleware: [] });
    gw.addRoute({ path: "/b", method: "POST", target: "t2", middleware: [] });
    expect(gw.listRoutes()).toHaveLength(2);
  });
});