import { AuthenticationService } from "../src/services/authentication.service";

describe("AuthenticationService", () => {
  const svc = new AuthenticationService();

  it("should authenticate valid credentials", async () => {
    const result = await svc.authenticate({ email: "a@b.com", password: "pass" });
    expect(result).toBe("a@b.com");
  });

  it("should reject empty credentials", async () => {
    expect(await svc.authenticate({ email: "", password: "pass" })).toBeNull();
  });
});
