import { TokenService } from "../src/services/TokenService";

describe("TokenService", () => {
  const service = new TokenService("test-secret", 3600);

  it("should sign and verify token", () => {
    const token = service.sign({
      sub: "user1",
      email: "user@test.com",
      roles: ["user"]
    });
    const payload = service.verify(token);
    expect(payload?.sub).toBe("user1");
  });

  it("should return null for invalid token", () => {
    expect(service.verify("invalid")).toBeNull();
  });
});
