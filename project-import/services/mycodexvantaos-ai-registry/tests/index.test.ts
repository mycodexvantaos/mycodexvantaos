import { ModuleLoaderService, PluginManagerService, bootstrap } from "../src";

describe("ModuleLoaderService", () => {
  let svc: ModuleLoaderService;
  beforeEach(() => { svc = new ModuleLoaderService(); });

  it("should load a module", async () => {
    const mod = await svc.load("auth", "1.0.0");
    expect(mod.status).toBe("loaded");
    expect(svc.has("auth")).toBe(true);
  });

  it("should unload a module", async () => {
    await svc.load("tmp", "0.1.0");
    expect(await svc.unload("tmp")).toBe(true);
    expect(svc.get("tmp")?.status).toBe("unloaded");
  });

  it("should list loaded modules only", async () => {
    await svc.load("a", "1.0"); await svc.load("b", "1.0");
    await svc.unload("b");
    expect(svc.listLoaded()).toHaveLength(1);
    expect(svc.list()).toHaveLength(2);
  });

  it("should return null for unknown module", () => {
    expect(svc.get("missing")).toBeNull();
  });
});

describe("PluginManagerService", () => {
  let svc: PluginManagerService;
  beforeEach(() => { svc = new PluginManagerService(); });

  it("should register a plugin", () => {
    const p = svc.register({ name: "lint", version: "1.0", enabled: true, author: "dev", description: "linter" });
    expect(p.id).toMatch(/^plugin-lint-/);
    expect(svc.list()).toHaveLength(1);
  });

  it("should unregister a plugin", () => {
    const p = svc.register({ name: "fmt", version: "1.0", enabled: true, author: "dev", description: "formatter" });
    expect(svc.unregister(p.id)).toBe(true);
    expect(svc.list()).toHaveLength(0);
  });

  it("should enable and disable a plugin", () => {
    const p = svc.register({ name: "x", version: "1.0", enabled: true, author: "a", description: "d" });
    svc.disable(p.id);
    expect(svc.get(p.id)?.enabled).toBe(false);
    svc.enable(p.id);
    expect(svc.get(p.id)?.enabled).toBe(true);
  });

  it("should list enabled plugins only", () => {
    const p1 = svc.register({ name: "a", version: "1.0", enabled: true, author: "x", description: "d" });
    svc.register({ name: "b", version: "1.0", enabled: false, author: "x", description: "d" });
    expect(svc.listEnabled()).toHaveLength(1);
    expect(svc.listEnabled()[0].id).toBe(p1.id);
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});