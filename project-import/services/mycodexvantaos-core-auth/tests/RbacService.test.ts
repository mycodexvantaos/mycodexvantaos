import { RbacService } from "../src/services/RbacService";

describe("RbacService", () => {
  it("should grant and check permissions", () => {
    const rbac = new RbacService();
    rbac.grant("admin", { resource: "users", action: "write" });
    expect(rbac.check("admin", "users", "write")).toBe(true);
    expect(rbac.check("admin", "users", "read")).toBe(false);
  });
});
