import {
  LoggingService,
  MetricsService,
  TracingService,
  AlertingService,
  bootstrap,
} from "../src";

describe("LoggingService", () => {
  let svc: LoggingService;
  beforeEach(() => { svc = new LoggingService("test-svc"); });

  it("should log and query messages", () => {
    svc.info("hello");
    svc.warn("caution");
    const all = svc.query();
    expect(all).toHaveLength(2);
    expect(all[0].level).toBe("info");
    expect(all[0].source).toBe("test-svc");
  });

  it("should filter by level", () => {
    svc.debug("d"); svc.info("i"); svc.error("e");
    const errors = svc.query({ level: "error" });
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toBe("e");
  });

  it("should create a child logger", () => {
    const child = svc.child("sub-svc");
    child.info("from child");
    const logs = child.query();
    expect(logs[0].source).toBe("sub-svc");
  });

  it("should respect minLevel", () => {
    const warnOnly = new LoggingService("svc", "warn");
    warnOnly.debug("skip"); warnOnly.info("skip"); warnOnly.warn("keep");
    expect(warnOnly.query()).toHaveLength(1);
  });
});

describe("MetricsService", () => {
  let svc: MetricsService;
  beforeEach(() => { svc = new MetricsService(); });

  it("should increment a counter", () => {
    svc.increment("requests");
    svc.increment("requests", 5);
    expect(svc.get("requests")?.value).toBe(6);
  });

  it("should set a gauge", () => {
    svc.setGauge("cpu", 72.5);
    expect(svc.get("cpu")?.value).toBe(72.5);
    svc.setGauge("cpu", 45.0);
    expect(svc.get("cpu")?.value).toBe(45.0);
  });

  it("should record and query history", () => {
    svc.record("latency", 100);
    svc.record("latency", 200);
    const history = svc.query("latency");
    expect(history).toHaveLength(2);
    expect(history[1].value).toBe(200);
  });

  it("should list all metric names", () => {
    svc.increment("a"); svc.setGauge("b", 1); svc.record("c", 2);
    expect(svc.list().sort()).toEqual(["a", "b", "c"]);
  });
});

describe("TracingService", () => {
  let svc: TracingService;
  beforeEach(() => { svc = new TracingService("test-tracer"); });

  it("should start and end a span", () => {
    const span = svc.startSpan("op1");
    expect(span.id).toBeDefined();
    expect(span.traceId).toBeDefined();
    svc.endSpan(span.id, "ok");
    const ended = svc.getSpan(span.id);
    expect(ended?.endTime).toBeDefined();
    expect(ended?.attributes["status"]).toBe("ok");
  });

  it("should build a trace from spans", () => {
    const parent = svc.startSpan("parent");
    const child = svc.startSpan("child", { parentContext: { traceId: parent.traceId, spanId: parent.id } });
    svc.endSpan(child.id); svc.endSpan(parent.id);
    const trace = svc.getTrace(parent.traceId);
    expect(trace).not.toBeNull();
    expect(trace!.spans).toHaveLength(2);
    expect(trace!.status).toBe("ok");
  });

  it("should track error status", () => {
    const span = svc.startSpan("fail-op");
    svc.endSpan(span.id, "error", "something broke");
    const trace = svc.getTrace(span.traceId);
    expect(trace!.status).toBe("error");
  });

  it("should use withSpan helper", async () => {
    const result = await svc.withSpan("compute", async () => 42);
    expect(result).toBe(42);
    const traces = svc.listTraces();
    expect(traces).toHaveLength(1);
  });
});

describe("AlertingService", () => {
  let svc: AlertingService;
  beforeEach(() => { svc = new AlertingService(); });

  it("should upsert and list rules", () => {
    svc.upsertRule({ id: "r1", name: "HighCPU", condition: "cpu_high", severity: "high", enabled: true });
    svc.upsertRule({ id: "r2", name: "DiskFull", condition: "disk_full", severity: "critical", enabled: true });
    expect(svc.listRules()).toHaveLength(2);
  });

  it("should delete a rule", () => {
    svc.upsertRule({ id: "r1", name: "test", condition: "x", severity: "low", enabled: true });
    expect(svc.deleteRule("r1")).toBe(true);
    expect(svc.listRules()).toHaveLength(0);
  });

  it("should fire and acknowledge an alert", () => {
    svc.upsertRule({ id: "r1", name: "HighMem", condition: "mem", severity: "high", enabled: true });
    const alert = svc.fireAlert("r1", "Memory above 90%");
    expect(alert.severity).toBe("high");
    expect(alert.acknowledged).toBe(false);
    svc.acknowledge(alert.id, "admin");
    const alerts = svc.listAlerts({ acknowledged: true });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].acknowledgedBy).toBe("admin");
  });

  it("should evaluate rules against context", () => {
    svc.upsertRule({ id: "r1", name: "CPUAlert", condition: "cpu_high", severity: "high", enabled: true });
    svc.upsertRule({ id: "r2", name: "Disabled", condition: "disk_full", severity: "low", enabled: false });
    const fired = svc.evaluate({ cpu_high: 95, disk_full: true });
    expect(fired).toHaveLength(1);
    expect(fired[0].ruleName).toBe("CPUAlert");
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});