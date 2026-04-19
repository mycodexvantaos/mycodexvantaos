import { createCli, loadConfig, createLogger } from "../src/index";

describe("cli index exports", () => {
  it("should export createCli", () => {
    expect(createCli).toBeDefined();
  });

  it("should export loadConfig", () => {
    expect(loadConfig).toBeDefined();
  });

  it("should export createLogger", () => {
    expect(createLogger).toBeDefined();
  });
});
