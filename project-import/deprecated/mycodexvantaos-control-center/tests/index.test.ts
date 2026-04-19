import { OrchestrationService } from "../src/orchestration";
import { RegistryService } from "../src/registry";

describe("OrchestrationService", () => {
  let svc: OrchestrationService;

  beforeEach(() => {
    svc = new OrchestrationService();
  });

  it("should register and retrieve repos", () => {
    svc.registerRepo({ name: "core", layer: "kernel", plane: "control", tier: 0, status: "pending" });
    expect(svc.getRepo("core")).not.toBeNull();
    expect(svc.getRepo("core")!.tier).toBe(0);
  });

  it("should unregister a repo", () => {
    svc.registerRepo({ name: "core", layer: "kernel", plane: "control", tier: 0, status: "pending" });
    expect(svc.unregisterRepo("core")).toBe(true);
    expect(svc.getRepo("core")).toBeNull();
  });

  it("should list repos sorted by tier", () => {
    svc.registerRepo({ name: "t2", layer: "l", plane: "p", tier: 2, status: "pending" });
    svc.registerRepo({ name: "t0", layer: "l", plane: "p", tier: 0, status: "pending" });
    svc.registerRepo({ name: "t1", layer: "l", plane: "p", tier: 1, status: "pending" });
    const list = svc.listRepos();
    expect(list[0].name).toBe("t0");
    expect(list[2].name).toBe("t2");
  });

  it("should orchestrate all repos by tier", () => {
    svc.registerRepo({ name: "a", layer: "l", plane: "p", tier: 0, status: "pending" });
    svc.registerRepo({ name: "b", layer: "l", plane: "p", tier: 1, status: "pending" });
    const result = svc.orchestrate();
    expect(result.success).toBe(true);
    expect(result.reposProcessed).toBe(2);
    expect(svc.getRepo("a")!.status).toBe("processed");
    expect(svc.getRepo("b")!.status).toBe("processed");
  });

  it("should report status after orchestration", () => {
    svc.registerRepo({ name: "a", layer: "l", plane: "p", tier: 0, status: "pending" });
    svc.orchestrate();
    const status = svc.getStatus();
    expect(status.phase).toBe("completed");
    expect(status.progress).toBe(100);
    expect(status.repoStatuses["a"]).toBe("processed");
  });
});

describe("RegistryService", () => {
  let reg: RegistryService;

  beforeEach(() => {
    reg = new RegistryService();
  });

  it("should add and retrieve entries", () => {
    reg.add({ name: "core", layer: "kernel", plane: "control", tier: 0, status: "active" });
    expect(reg.get("core")).not.toBeNull();
    expect(reg.list()).toHaveLength(1);
  });

  it("should remove an entry", () => {
    reg.add({ name: "core", layer: "kernel", plane: "control", tier: 0, status: "active" });
    expect(reg.remove("core")).toBe(true);
    expect(reg.get("core")).toBeNull();
  });

  it("should sync incoming entries", () => {
    reg.add({ name: "old", layer: "l", plane: "p", tier: 0, status: "active" });
    const result = reg.sync([
      { name: "new1", layer: "l", plane: "p", tier: 0, status: "active" },
      { name: "new2", layer: "l", plane: "p", tier: 1, status: "active" },
    ]);
    expect(result.added).toBe(2);
    expect(result.removed).toBe(1);
    expect(reg.list()).toHaveLength(2);
  });

  it("should track global state", () => {
    reg.setMode("maintenance");
    reg.setPhase("scanning");
    reg.add({ name: "core", layer: "l", plane: "p", tier: 0, status: "active" });
    const state = reg.getGlobalState();
    expect(state.mode).toBe("maintenance");
    expect(state.phase).toBe("scanning");
    expect(state.repos["core"]).toBeDefined();
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    const { bootstrap } = await import("../src/index");
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});