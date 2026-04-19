import { ModelRegistryService } from "../src/model-registry";
import { AgentService } from "../src/agent";

describe("ModelRegistryService", () => {
  let registry: ModelRegistryService;

  beforeEach(() => {
    registry = new ModelRegistryService();
  });

  it("should register and retrieve a model", () => {
    const model = registry.register("gpt-4", "openai", 128000);
    expect(model.id).toBeDefined();
    expect(registry.getModel(model.id)!.name).toBe("gpt-4");
  });

  it("should unregister a model", () => {
    const model = registry.register("test", "local", 4096);
    expect(registry.unregister(model.id)).toBe(true);
    expect(registry.getModel(model.id)).toBeNull();
  });

  it("should find model by name", () => {
    registry.register("gpt-4", "openai", 128000);
    expect(registry.findByName("gpt-4")).not.toBeNull();
    expect(registry.findByName("nonexistent")).toBeNull();
  });

  it("should list models by provider", () => {
    registry.register("gpt-4", "openai", 128000);
    registry.register("gpt-3.5", "openai", 16384);
    registry.register("claude", "anthropic", 200000);
    expect(registry.listByProvider("openai")).toHaveLength(2);
    expect(registry.listByProvider("anthropic")).toHaveLength(1);
  });

  it("should generate stub completion", () => {
    const model = registry.register("gpt-4", "openai", 128000);
    const response = registry.complete(model.id, "Hello world");
    expect(response.model).toBe("gpt-4");
    expect(response.content).toContain("gpt-4");
    expect(response.tokens.total).toBeGreaterThan(0);
    expect(response.finishReason).toBe("stop");
  });

  it("should throw for unknown model completion", () => {
    expect(() => registry.complete("nonexistent", "test")).toThrow();
  });
});

describe("AgentService", () => {
  let svc: AgentService;

  beforeEach(() => {
    svc = new AgentService();
  });

  it("should create and retrieve an agent", () => {
    const agent = svc.create("coder", "gpt-4", ["code", "search"], "You are a coder");
    expect(agent.id).toBeDefined();
    expect(svc.getAgent(agent.id)!.name).toBe("coder");
  });

  it("should remove an agent", () => {
    const agent = svc.create("test", "model", [], "prompt");
    expect(svc.remove(agent.id)).toBe(true);
    expect(svc.getAgent(agent.id)).toBeNull();
  });

  it("should list agents", () => {
    svc.create("a1", "m", [], "p");
    svc.create("a2", "m", [], "p");
    expect(svc.listAgents()).toHaveLength(2);
  });

  it("should track agent status", () => {
    const agent = svc.create("test", "model", [], "prompt");
    expect(svc.getStatus(agent.id)!.state).toBe("idle");
    svc.run(agent.id, "do something");
    expect(svc.getStatus(agent.id)!.state).toBe("completed");
  });

  it("should run agent and return result with steps", () => {
    const agent = svc.create("coder", "gpt-4", ["code"], "You code");
    const result = svc.run(agent.id, "write a function");
    expect(result.agentId).toBe(agent.id);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);
    expect(result.tokensUsed).toBeGreaterThan(0);
    expect(result.output).toBeDefined();
  });

  it("should throw for unknown agent run", () => {
    expect(() => svc.run("nonexistent", "test")).toThrow();
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    const { bootstrap } = await import("../src/index");
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});