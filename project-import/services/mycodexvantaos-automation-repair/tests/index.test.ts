import { WorkflowEngineService } from "../src/workflow-engine";
import { StateMachineService } from "../src/state-machine";

describe("WorkflowEngineService", () => {
  let engine: WorkflowEngineService;

  beforeEach(() => {
    engine = new WorkflowEngineService();
  });

  it("should register and retrieve a workflow", () => {
    const wf = engine.register("deploy", [
      { name: "build", action: "compile", config: {}, retries: 0, timeout: 60 },
    ]);
    expect(wf.id).toBeDefined();
    expect(engine.getWorkflow(wf.id)!.name).toBe("deploy");
  });

  it("should unregister a workflow", () => {
    const wf = engine.register("test", []);
    expect(engine.unregister(wf.id)).toBe(true);
    expect(engine.getWorkflow(wf.id)).toBeNull();
  });

  it("should list workflows", () => {
    engine.register("w1", []);
    engine.register("w2", []);
    expect(engine.listWorkflows()).toHaveLength(2);
  });

  it("should create an execution", () => {
    const wf = engine.register("deploy", []);
    const exec = engine.execute(wf.id);
    expect(exec.status).toBe("pending");
    expect(exec.workflowId).toBe(wf.id);
  });

  it("should run an execution through all steps", () => {
    const wf = engine.register("deploy", [
      { name: "build", action: "compile", config: {}, retries: 0, timeout: 60 },
      { name: "test", action: "jest", config: {}, retries: 1, timeout: 120 },
    ]);
    const exec = engine.execute(wf.id);
    const results = engine.runExecution(exec.id);
    expect(results).toHaveLength(2);
    expect(results[0].stepName).toBe("build");
    expect(results[0].status).toBe("success");
    expect(engine.getExecution(exec.id)!.status).toBe("completed");
  });

  it("should list executions filtered by workflow", () => {
    const wf1 = engine.register("w1", []);
    const wf2 = engine.register("w2", []);
    engine.execute(wf1.id);
    engine.execute(wf1.id);
    engine.execute(wf2.id);
    expect(engine.listExecutions(wf1.id)).toHaveLength(2);
    expect(engine.listExecutions()).toHaveLength(3);
  });
});

describe("StateMachineService", () => {
  let svc: StateMachineService;

  beforeEach(() => {
    svc = new StateMachineService();
  });

  it("should create a state machine", () => {
    const sm = svc.create("order", ["created", "paid", "shipped"], [
      { from: "created", to: "paid", event: "pay" },
      { from: "paid", to: "shipped", event: "ship" },
    ], "created");
    expect(sm.id).toBeDefined();
    expect(svc.getCurrentState(sm.id)).toBe("created");
  });

  it("should reject invalid initial state", () => {
    expect(() => svc.create("bad", ["a", "b"], [], "c")).toThrow();
  });

  it("should transition on valid event", () => {
    const sm = svc.create("order", ["created", "paid"], [
      { from: "created", to: "paid", event: "pay" },
    ], "created");
    const trans = svc.transition(sm.id, "pay");
    expect(trans).not.toBeNull();
    expect(trans!.from).toBe("created");
    expect(trans!.to).toBe("paid");
    expect(svc.getCurrentState(sm.id)).toBe("paid");
  });

  it("should return null for invalid transition", () => {
    const sm = svc.create("order", ["created", "paid"], [
      { from: "created", to: "paid", event: "pay" },
    ], "created");
    expect(svc.transition(sm.id, "ship")).toBeNull();
  });

  it("should track transition history", () => {
    const sm = svc.create("flow", ["a", "b", "c"], [
      { from: "a", to: "b", event: "next" },
      { from: "b", to: "c", event: "next" },
    ], "a");
    svc.transition(sm.id, "next");
    svc.transition(sm.id, "next");
    expect(svc.getHistory(sm.id)).toHaveLength(2);
  });

  it("should reset to initial state", () => {
    const sm = svc.create("flow", ["a", "b"], [
      { from: "a", to: "b", event: "next" },
    ], "a");
    svc.transition(sm.id, "next");
    expect(svc.reset(sm.id)).toBe(true);
    expect(svc.getCurrentState(sm.id)).toBe("a");
    expect(svc.getHistory(sm.id)).toHaveLength(0);
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    const { bootstrap } = await import("../src/index");
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});