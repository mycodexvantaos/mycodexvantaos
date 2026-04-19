import {
  ProvisioningService,
  EnvironmentService,
  bootstrap,
} from "../src";

describe("ProvisioningService", () => {
  let svc: ProvisioningService;
  beforeEach(() => { svc = new ProvisioningService(); });

  it("should provision a resource and return result", async () => {
    const result = await svc.provision({ name: "test-db", type: "database" });
    expect(result.status).toBe("ready");
    expect(result.environmentId).toMatch(/^res-database-/);
    expect(result.endpoints).toHaveProperty("primary");
  });

  it("should list resources with optional filter", async () => {
    await svc.provision({ name: "db1", type: "database" });
    await svc.provision({ name: "q1", type: "queue" });
    const all = await svc.listResources();
    expect(all).toHaveLength(2);
    const dbOnly = await svc.listResources({ type: "database" });
    expect(dbOnly).toHaveLength(1);
  });

  it("should destroy a resource", async () => {
    const result = await svc.provision({ name: "tmp", type: "storage" });
    await svc.destroy(result.environmentId);
    const resource = await svc.getResource(result.environmentId);
    expect(resource?.status).toBe("destroyed");
  });

  it("should report status summary", async () => {
    await svc.provision({ name: "a", type: "database" });
    await svc.provision({ name: "b", type: "queue" });
    const status = await svc.getStatus();
    expect(status.total).toBe(2);
    expect(status.ready).toBe(2);
  });
});

describe("EnvironmentService", () => {
  let svc: EnvironmentService;
  beforeEach(() => { svc = new EnvironmentService(); });

  it("should create and get an environment", async () => {
    const env = await svc.create("dev", "development");
    expect(env.name).toBe("dev");
    const found = await svc.get(env.id);
    expect(found).not.toBeNull();
    expect(found?.type).toBe("development");
  });

  it("should list environments", async () => {
    await svc.create("dev");
    await svc.create("staging", "staging");
    const list = await svc.list();
    expect(list).toHaveLength(2);
  });

  it("should delete an environment", async () => {
    const env = await svc.create("tmp");
    const deleted = await svc.delete(env.id);
    expect(deleted).toBe(true);
    expect(await svc.get(env.id)).toBeNull();
  });

  it("should manage variables", async () => {
    const env = await svc.create("dev");
    await svc.setVariable(env.id, "PORT", "3000");
    const vars = await svc.getVariables(env.id);
    expect(vars.PORT).toBe("3000");
  });

  it("should clone an environment", async () => {
    const src = await svc.create("prod", "production");
    await svc.setVariable(src.id, "DB_URL", "pg://prod");
    const clone = await svc.clone(src.id, "staging-clone");
    expect(clone.name).toBe("staging-clone");
    const vars = await svc.getVariables(clone.id);
    expect(vars.DB_URL).toBe("pg://prod");
  });

  it("should detect native mode by default", async () => {
    const mode = await svc.detectMode();
    expect(mode).toBe("native");
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});