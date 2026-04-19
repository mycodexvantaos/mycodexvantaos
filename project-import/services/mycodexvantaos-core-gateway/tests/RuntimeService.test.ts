import { RuntimeService } from "../src/services/RuntimeService";

describe("RuntimeService", () => {
  it("should report runtime info after start", async () => {
    const svc = new RuntimeService();
    await svc.start();
    expect(svc.isRunning()).toBe(true);
    expect(svc.info().pid).toBeGreaterThan(0);
  });
});
