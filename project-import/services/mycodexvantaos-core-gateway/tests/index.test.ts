import { HealthService, RuntimeService } from "../src/index";

describe("core-main index exports", () => {
  it("should export HealthService", () => {
    expect(HealthService).toBeDefined();
  });

  it("should export RuntimeService", () => {
    expect(RuntimeService).toBeDefined();
  });
});
