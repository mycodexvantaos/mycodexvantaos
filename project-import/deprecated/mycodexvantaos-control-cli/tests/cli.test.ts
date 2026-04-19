import { createCli } from "../src/cli";

describe("CLI", () => {
  it("should create cli program", () => {
    const cli = createCli();
    expect(cli.name()).toBe("codexvanta");
  });

  it("should register commands", () => {
    const cli = createCli();
    const names = cli.commands.map((c) => c.name());
    expect(names).toContain("init");
    expect(names).toContain("config");
    expect(names).toContain("deploy");
    expect(names).toContain("scan");
    expect(names).toContain("status");
  });
});
