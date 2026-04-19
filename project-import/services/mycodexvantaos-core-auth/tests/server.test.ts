import { buildServer } from "../src/server";

describe("auth-service server", () => {
  it("should respond to health check", async () => {
    const app = buildServer();
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe("ok");
    await app.close();
  });
});
