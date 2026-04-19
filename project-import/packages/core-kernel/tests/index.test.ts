import { ProviderRegistry } from "../src/registry";
import { bootstrapKernel } from "../src";

describe("ProviderRegistry", () => {
  it("should be instantiable", () => {
    const registry = new ProviderRegistry();
    expect(registry).toBeDefined();
  });

  it("should register and resolve a provider", () => {
    const registry = new ProviderRegistry();
    const mockProvider = {
      name: "mock-db",
      capability: "database" as const,
      initialize: async () => {},
      healthCheck: async () => true,
    };
    registry.register(mockProvider);
    expect(registry.has("database")).toBe(true);
    expect(registry.resolve("database")).toBe(mockProvider);
  });

  it("should throw when resolving unregistered capability", () => {
    const registry = new ProviderRegistry();
    expect(() => registry.resolve("storage")).toThrow("No provider registered");
  });

  it("should list registered capabilities", () => {
    const registry = new ProviderRegistry();
    registry.register({
      name: "mock-auth",
      capability: "auth",
      initialize: async () => {},
      healthCheck: async () => true,
    });
    expect(registry.list()).toContain("auth");
  });

  it("should run healthCheckAll", async () => {
    const registry = new ProviderRegistry();
    registry.register({
      name: "mock-queue",
      capability: "queue",
      initialize: async () => {},
      healthCheck: async () => true,
    });
    const results = await registry.healthCheckAll();
    expect(results.queue).toBe(true);
  });
});

describe("bootstrapKernel", () => {
  it("should complete without error", async () => {
    await expect(bootstrapKernel()).resolves.toBeUndefined();
  });
});
