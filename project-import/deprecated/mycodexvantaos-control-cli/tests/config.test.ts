import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("config utils", () => {
  const originalHome = process.env.HOME;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "codexvanta-cli-"));
    process.env.HOME = tempDir;
    jest.resetModules();
  });

  afterEach(() => {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should save and load config under HOME", () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { saveConfig, loadConfig, getConfigPath } = require("../src/utils/config");
    saveConfig({ apiUrl: "http://localhost:3002" });
    const config = loadConfig();
    expect(config.apiUrl).toBe("http://localhost:3002");
    expect(getConfigPath()).toContain(tempDir);
  });
});
