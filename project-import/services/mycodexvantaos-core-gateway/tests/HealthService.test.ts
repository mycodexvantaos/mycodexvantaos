import { HealthService } from "../src/services/HealthService";

describe("HealthService", () => {
  it("should report unhealthy before start", () => {
    const svc = new HealthService();
    expect(svc.check().status).toBe("unhealthy");
  });

  it("should report healthy after start", async () => {
    const svc = new HealthService();
    await svc.start();
    expect(svc.check().status).toBe("healthy");
  });
});
