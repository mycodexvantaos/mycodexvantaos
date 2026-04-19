import { buildServer } from "../src/server";

describe("auth routes", () => {
  it("should reject empty login", async () => {
    const app = await buildServer();
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "", password: "" }
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
