import pino from "pino";
import { LifecycleManager, Startable } from "../src/lifecycle";

const logger = pino({ level: "silent" });

function mockService(): Startable & { started: boolean } {
  return {
    started: false,
    async start() {
      this.started = true;
    },
    async stop() {
      this.started = false;
    }
  };
}

describe("LifecycleManager", () => {
  it("should start and stop services", async () => {
    const manager = new LifecycleManager(logger);
    const a = mockService();
    const b = mockService();

    manager.register("a", a);
    manager.register("b", b);

    await manager.startAll();
    expect(a.started).toBe(true);
    expect(b.started).toBe(true);

    await manager.stopAll();
    expect(a.started).toBe(false);
    expect(b.started).toBe(false);
  });
});
