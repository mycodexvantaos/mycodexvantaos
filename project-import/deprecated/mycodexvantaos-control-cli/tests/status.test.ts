import { createCli } from "../src/cli";

describe("status command", () => {
  it("should be registered", () => {
    const cli = createCli();
    const statusCmd = cli.commands.find((c) => c.name() === "status");
    expect(statusCmd).toBeDefined();
  });
});
