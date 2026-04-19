import { AuthService, TokenService, PasswordService, RbacService } from "../src/index";

describe("auth-service index exports", () => {
  it("should export all services", () => {
    expect(AuthService).toBeDefined();
    expect(TokenService).toBeDefined();
    expect(PasswordService).toBeDefined();
    expect(RbacService).toBeDefined();
  });
});
