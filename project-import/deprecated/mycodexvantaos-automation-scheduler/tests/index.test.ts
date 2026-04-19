import {
  SchedulerService,
  CronService,
  bootstrap,
} from "../src";

describe("SchedulerService", () => {
  let svc: SchedulerService;
  beforeEach(() => { svc = new SchedulerService(); });

  it("should schedule a task", async () => {
    const task = await svc.schedule("send-email", { to: "user@test.com" }, Date.now() + 60000);
    expect(task.id).toMatch(/^task-/);
    expect(task.name).toBe("send-email");
    expect(task.status).toBe("pending");
  });

  it("should get a task by id", async () => {
    const task = await svc.schedule("job1", {}, Date.now() + 1000);
    const found = await svc.getTask(task.id);
    expect(found).not.toBeNull();
    expect(found!.name).toBe("job1");
  });

  it("should cancel a task", async () => {
    const task = await svc.schedule("cancelme", {}, Date.now() + 99999);
    const cancelled = await svc.cancel(task.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("should list tasks with optional status filter", async () => {
    await svc.schedule("a", {}, Date.now() + 1000);
    await svc.schedule("b", {}, Date.now() + 2000);
    const t3 = await svc.schedule("c", {}, Date.now() + 3000);
    await svc.cancel(t3.id);
    const pending = await svc.listTasks("pending");
    expect(pending).toHaveLength(2);
    const cancelled = await svc.listTasks("cancelled");
    expect(cancelled).toHaveLength(1);
  });

  it("should process due tasks", async () => {
    await svc.schedule("past", {}, Date.now() - 1000);
    await svc.schedule("future", {}, Date.now() + 99999);
    const processed = await svc.processDueTasks();
    expect(processed).toBe(1);
  });
});

describe("CronService", () => {
  let svc: CronService;
  beforeEach(() => { svc = new CronService(); });

  it("should register a cron job", async () => {
    const job = await svc.register("cleanup", "every 5m", "cleanupHandler");
    expect(job.id).toMatch(/^cron-cleanup-/);
    expect(job.enabled).toBe(true);
    expect(job.nextRun).toBeDefined();
  });

  it("should list jobs", async () => {
    await svc.register("a", "every 1h", "handlerA");
    await svc.register("b", "every 30m", "handlerB");
    const jobs = await svc.listJobs();
    expect(jobs).toHaveLength(2);
  });

  it("should unregister a job", async () => {
    const job = await svc.register("tmp", "every 1m", "h");
    expect(await svc.unregister(job.id)).toBe(true);
    expect(await svc.listJobs()).toHaveLength(0);
  });

  it("should disable and enable a job", async () => {
    const job = await svc.register("toggle", "every 10m", "h");
    const disabled = await svc.disable(job.id);
    expect(disabled.enabled).toBe(false);
    const enabled = await svc.enable(job.id);
    expect(enabled.enabled).toBe(true);
  });

  it("should process due jobs", async () => {
    const job = await svc.register("due", "every 1s", "h");
    // Force nextRun to past
    const found = await svc.getJob(job.id);
    found!.nextRun = new Date(Date.now() - 1000);
    const processed = await svc.processDueJobs();
    expect(processed).toBe(1);
    expect(found!.lastRun).toBeDefined();
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});