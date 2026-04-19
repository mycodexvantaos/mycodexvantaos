import { buildServer } from "../src/server";

describe("dashboard routes", () => {
  it("should return dashboard summary", async () => {
    const app = await buildServer();
    const res = await app.inject({ method: "GET", url: "/api/dashboard/summary" });
    expect(res.statusCode).toBe(200);
    expect(res.json().services).toBe(1);
    await app.close();
  });
});
