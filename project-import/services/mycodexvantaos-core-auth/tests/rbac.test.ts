import { AuthorizationService } from "../src/services/authorization.service";

describe("AuthorizationService", () => {
  it("should allow permitted actions", () => {
    const svc = new AuthorizationService();
    svc.addPolicy("admin", "users:write");
    expect(svc.isAllowed("admin", "users:write")).toBe(true);
    expect(svc.isAllowed("admin", "users:delete")).toBe(false);
  });
});
