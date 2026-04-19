import { AppPortalService, AggregationService } from "../src/index";

describe("app-portal index exports", () => {
  it("should export services", () => {
    expect(AppPortalService).toBeDefined();
    expect(AggregationService).toBeDefined();
  });
});
