import { PipelineService } from "../src/pipeline";
import { TriggerService } from "../src/trigger";

describe("PipelineService", () => {
  let svc: PipelineService;

  beforeEach(() => {
    svc = new PipelineService();
  });

  it("should create and retrieve a pipeline", () => {
    const pipe = svc.create("deploy", [
      { name: "build", steps: ["compile", "bundle"], parallel: false },
      { name: "test", steps: ["unit", "integration"], parallel: true },
    ], ["push"], "my-repo");
    expect(pipe.id).toBeDefined();
    expect(svc.getPipeline(pipe.id)!.name).toBe("deploy");
  });

  it("should remove a pipeline", () => {
    const pipe = svc.create("p1", [], [], "repo");
    expect(svc.remove(pipe.id)).toBe(true);
    expect(svc.getPipeline(pipe.id)).toBeNull();
  });

  it("should list pipelines by repo", () => {
    svc.create("p1", [], [], "repo-a");
    svc.create("p2", [], [], "repo-a");
    svc.create("p3", [], [], "repo-b");
    expect(svc.listByRepo("repo-a")).toHaveLength(2);
  });

  it("should trigger a pipeline run", () => {
    const pipe = svc.create("deploy", [], [], "repo");
    const run = svc.trigger(pipe.id);
    expect(run.status).toBe("pending");
    expect(run.pipelineId).toBe(pipe.id);
  });

  it("should run a pipeline to success", () => {
    const pipe = svc.create("deploy", [
      { name: "build", steps: ["compile"], parallel: false },
    ], [], "repo");
    const run = svc.trigger(pipe.id);
    const completed = svc.runPipeline(run.id);
    expect(completed.status).toBe("success");
    expect(completed.completedAt).toBeDefined();
  });

  it("should cancel a pending run", () => {
    const pipe = svc.create("deploy", [], [], "repo");
    const run = svc.trigger(pipe.id);
    expect(svc.cancelRun(run.id)).toBe(true);
    expect(svc.getRun(run.id)!.status).toBe("cancelled");
  });

  it("should not cancel a completed run", () => {
    const pipe = svc.create("deploy", [], [], "repo");
    const run = svc.trigger(pipe.id);
    svc.runPipeline(run.id);
    expect(svc.cancelRun(run.id)).toBe(false);
  });

  it("should list runs filtered by pipeline", () => {
    const p1 = svc.create("p1", [], [], "repo");
    const p2 = svc.create("p2", [], [], "repo");
    svc.trigger(p1.id);
    svc.trigger(p1.id);
    svc.trigger(p2.id);
    expect(svc.listRuns(p1.id)).toHaveLength(2);
    expect(svc.listRuns()).toHaveLength(3);
  });
});

describe("TriggerService", () => {
  let svc: TriggerService;

  beforeEach(() => {
    svc = new TriggerService();
  });

  it("should register and retrieve a trigger", () => {
    const trig = svc.register("webhook", { url: "https://hook.example.com" }, "pipe-1");
    expect(trig.id).toBeDefined();
    expect(trig.enabled).toBe(true);
    expect(svc.getTrigger(trig.id)!.type).toBe("webhook");
  });

  it("should unregister a trigger", () => {
    const trig = svc.register("cron", { schedule: "0 * * * *" }, "pipe-1");
    expect(svc.unregister(trig.id)).toBe(true);
    expect(svc.getTrigger(trig.id)).toBeNull();
  });

  it("should list triggers by pipeline", () => {
    svc.register("webhook", {}, "pipe-1");
    svc.register("cron", {}, "pipe-1");
    svc.register("webhook", {}, "pipe-2");
    expect(svc.listByPipeline("pipe-1")).toHaveLength(2);
  });

  it("should list triggers by type", () => {
    svc.register("webhook", {}, "p1");
    svc.register("cron", {}, "p2");
    svc.register("webhook", {}, "p3");
    expect(svc.listByType("webhook")).toHaveLength(2);
    expect(svc.listByType("cron")).toHaveLength(1);
  });

  it("should enable and disable triggers", () => {
    const trig = svc.register("event", {}, "pipe-1");
    expect(svc.disable(trig.id)).toBe(true);
    expect(svc.getTrigger(trig.id)!.enabled).toBe(false);
    expect(svc.enable(trig.id)).toBe(true);
    expect(svc.getTrigger(trig.id)!.enabled).toBe(true);
  });

  it("should evaluate events against enabled triggers", () => {
    svc.register("webhook", {}, "p1");
    const t2 = svc.register("webhook", {}, "p2");
    svc.register("cron", {}, "p3");
    svc.disable(t2.id);
    const matched = svc.evaluate({ type: "webhook", payload: {} });
    expect(matched).toHaveLength(1);
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    const { bootstrap } = await import("../src/index");
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});