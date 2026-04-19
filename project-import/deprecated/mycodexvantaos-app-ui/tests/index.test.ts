import { describe, it, expect } from "vitest";

describe("app-ui index", () => {
  it("should be importable", async () => {
    const mod = await import("../src/index");
    expect(mod.App).toBeDefined();
  });
});
