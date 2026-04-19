import { DashboardController } from "../src/controllers/DashboardController";

describe("DashboardController", () => {
  it("should return summary", async () => {
    const ctrl = new DashboardController();
    const data = await ctrl.summary();
    expect(data).toHaveProperty("services");
  });
});
