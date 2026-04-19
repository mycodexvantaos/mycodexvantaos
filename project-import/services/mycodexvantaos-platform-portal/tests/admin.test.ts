import { buildServer } from "../src/server";

describe("admin routes", () => {
  it("should require authorization", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/admin/status" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
