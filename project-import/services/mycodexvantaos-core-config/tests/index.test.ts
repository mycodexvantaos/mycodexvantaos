import { ConfigService, FeatureFlagService } from "../src";

describe("ConfigService", () => {
  let config: ConfigService;

  beforeEach(() => {
    config = new ConfigService();
  });

  it("should set and get a config value", async () => {
    await config.set("db.host", "localhost");
    const value = await config.get<string>("db.host");
    expect(value).toBe("localhost");
  });

  it("should return defaultValue when key not found", async () => {
    const value = await config.get<number>("missing", { defaultValue: 42 });
    expect(value).toBe(42);
  });

  it("should respect scope precedence (environment > service > global)", async () => {
    await config.set("port", 3000, { scope: "global" });
    await config.set("port", 8080, { scope: "environment" });
    const value = await config.get<number>("port");
    expect(value).toBe(8080);
  });

  it("should delete a config entry", async () => {
    await config.set("temp", "value");
    const deleted = await config.delete("temp");
    expect(deleted).toBe(true);
    const value = await config.get("temp");
    expect(value).toBeUndefined();
  });

  it("should list entries by scope", async () => {
    await config.set("a", 1, { scope: "global" });
    await config.set("b", 2, { scope: "service" });
    const globals = await config.list("global");
    expect(globals).toHaveLength(1);
    expect(globals[0].key).toBe("a");
  });
});

describe("FeatureFlagService", () => {
  let flags: FeatureFlagService;

  beforeEach(() => {
    flags = new FeatureFlagService();
  });

  it("should return false for unknown flags", () => {
    expect(flags.isEnabled("unknown")).toBe(false);
  });

  it("should set and check a flag", () => {
    flags.setFlag("dark-mode", true);
    expect(flags.isEnabled("dark-mode")).toBe(true);
  });

  it("should list all flags", () => {
    flags.setFlag("a", true);
    flags.setFlag("b", false);
    expect(flags.listFlags()).toEqual({ a: true, b: false });
  });
});
