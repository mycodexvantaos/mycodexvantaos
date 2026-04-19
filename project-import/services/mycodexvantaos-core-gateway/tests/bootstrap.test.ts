import { bootstrap } from "../src/bootstrap";

jest.mock("pino", () => {
  const info = jest.fn();
  return () => ({ info, warn: jest.fn(), error: jest.fn() });
});

describe("bootstrap", () => {
  it("should complete without throwing", async () => {
    await expect(bootstrap({ port: 0 })).resolves.toBeUndefined();
  });
});
