import { createCli } from "../src/cli";

describe("init command", () => {
  it("should be registered", () => {
    const cli = createCli();
    const initCmd = cli.commands.find((c) => c.name() === "init");
    expect(initCmd).toBeDefined();
  });
});
