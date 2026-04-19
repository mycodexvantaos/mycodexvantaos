import { createCli } from "../src/cli";

describe("scan command", () => {
  it("should be registered", () => {
    const cli = createCli();
    const scanCmd = cli.commands.find((c) => c.name() === "scan");
    expect(scanCmd).toBeDefined();
  });
});
