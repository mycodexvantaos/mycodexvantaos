import { SandboxManagerService } from "../src/sandbox-manager";

describe("SandboxManagerService", () => {
  let mgr: SandboxManagerService;

  beforeEach(() => {
    mgr = new SandboxManagerService();
  });

  it("should create a sandbox in running state", () => {
    const sbx = mgr.create("test-sbx", "node:20-slim");
    expect(sbx.id).toBeDefined();
    expect(sbx.status).toBe("running");
    expect(sbx.name).toBe("test-sbx");
    expect(sbx.image).toBe("node:20-slim");
  });

  it("should get a sandbox by id", () => {
    const sbx = mgr.create("s1", "img");
    expect(mgr.get(sbx.id)).toEqual(sbx);
    expect(mgr.get("nonexistent")).toBeNull();
  });

  it("should list all sandboxes", () => {
    mgr.create("s1", "img1");
    mgr.create("s2", "img2");
    expect(mgr.list()).toHaveLength(2);
  });

  it("should list sandboxes by status", () => {
    const s1 = mgr.create("s1", "img");
    mgr.create("s2", "img");
    mgr.pause(s1.id);
    expect(mgr.listByStatus("paused")).toHaveLength(1);
    expect(mgr.listByStatus("running")).toHaveLength(1);
  });

  it("should pause and resume a sandbox", () => {
    const sbx = mgr.create("s1", "img");
    expect(mgr.pause(sbx.id)).toBe(true);
    expect(mgr.get(sbx.id)!.status).toBe("paused");
    expect(mgr.resume(sbx.id)).toBe(true);
    expect(mgr.get(sbx.id)!.status).toBe("running");
  });

  it("should not pause a non-running sandbox", () => {
    const sbx = mgr.create("s1", "img");
    mgr.terminate(sbx.id);
    expect(mgr.pause(sbx.id)).toBe(false);
  });

  it("should terminate a sandbox", () => {
    const sbx = mgr.create("s1", "img");
    expect(mgr.terminate(sbx.id)).toBe(true);
    expect(mgr.get(sbx.id)!.status).toBe("terminated");
    expect(mgr.terminate(sbx.id)).toBe(false);
  });

  it("should get resource usage for running sandbox", () => {
    const sbx = mgr.create("s1", "img");
    const usage = mgr.getUsage(sbx.id);
    expect(usage).not.toBeNull();
    expect(usage!.cpuPercent).toBeGreaterThan(0);
    expect(usage!.memoryUsedMB).toBeGreaterThan(0);
  });

  it("should return null usage for non-running sandbox", () => {
    const sbx = mgr.create("s1", "img");
    mgr.pause(sbx.id);
    expect(mgr.getUsage(sbx.id)).toBeNull();
  });

  it("should destroy a sandbox completely", () => {
    const sbx = mgr.create("s1", "img");
    expect(mgr.destroy(sbx.id)).toBe(true);
    expect(mgr.get(sbx.id)).toBeNull();
  });

  it("should apply custom resource limits", () => {
    const sbx = mgr.create("s1", "img", { cpuCores: 8, memoryMB: 16384 });
    expect(sbx.resources.cpuCores).toBe(8);
    expect(sbx.resources.memoryMB).toBe(16384);
    expect(sbx.resources.diskMB).toBe(10240); // default
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    const { bootstrap } = await import("../src/index");
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});