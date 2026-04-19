import { SessionService } from "../src/services/session.service";

describe("SessionService", () => {
  it("should create and retrieve a session", () => {
    const svc = new SessionService();
    const session = svc.create("user1", 60000);
    expect(svc.get(session.id)).not.toBeNull();
  });

  it("should revoke a session", () => {
    const svc = new SessionService();
    const session = svc.create("user1", 60000);
    expect(svc.revoke(session.id)).toBe(true);
    expect(svc.get(session.id)).toBeNull();
  });
});
