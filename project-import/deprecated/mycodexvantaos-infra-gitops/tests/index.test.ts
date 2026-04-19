import { GitOpsSyncService } from "../src/sync";

describe("GitOpsSyncService", () => {
  let svc: GitOpsSyncService;

  beforeEach(() => {
    svc = new GitOpsSyncService();
  });

  it("should set and get desired state", () => {
    const state = { manifests: [{ name: "svc-a", replicas: 3 }], commitHash: "abc123", branch: "main" };
    svc.setDesiredState(state);
    expect(svc.getDesiredState()).toEqual(state);
  });

  it("should return sync error when no desired state", () => {
    const result = svc.sync();
    expect(result.synced).toBe(false);
    expect(result.errors).toHaveLength(1);
  });

  it("should sync desired state to actual", () => {
    svc.setDesiredState({ manifests: [{ name: "svc-a" }, { name: "svc-b" }], commitHash: "abc", branch: "main" });
    const result = svc.sync();
    expect(result.synced).toBe(true);
    expect(result.changes).toBe(2);
    expect(svc.getActualState().resources).toHaveLength(2);
  });

  it("should apply and remove individual resources", () => {
    svc.applyResource("r1", { kind: "Deployment" });
    expect(svc.getActualState().resources).toHaveLength(1);
    expect(svc.removeResource("r1")).toBe(true);
    expect(svc.getActualState().resources).toHaveLength(0);
  });

  it("should detect drift when resource is missing", () => {
    svc.setDesiredState({ manifests: [{ name: "svc-a" }], commitHash: "abc", branch: "main" });
    const drift = svc.detectDrift();
    expect(drift.hasDrift).toBe(true);
    expect(drift.drifts).toHaveLength(1);
    expect(drift.drifts[0].resource).toBe("svc-a");
  });

  it("should detect no drift when in sync", () => {
    svc.setDesiredState({ manifests: [{ name: "svc-a" }], commitHash: "abc", branch: "main" });
    svc.sync();
    const drift = svc.detectDrift();
    expect(drift.hasDrift).toBe(false);
  });

  it("should detect drift on field mismatch", () => {
    svc.setDesiredState({ manifests: [{ name: "svc-a", replicas: 3 }], commitHash: "abc", branch: "main" });
    svc.applyResource("svc-a", { name: "svc-a", replicas: 1 });
    const drift = svc.detectDrift();
    expect(drift.hasDrift).toBe(true);
    const replicaDrift = drift.drifts.find((d) => d.field === "replicas");
    expect(replicaDrift).toBeDefined();
    expect(replicaDrift!.expected).toBe(3);
    expect(replicaDrift!.actual).toBe(1);
  });

  it("should reconcile drift", () => {
    svc.setDesiredState({ manifests: [{ name: "svc-a", replicas: 3 }], commitHash: "abc", branch: "main" });
    svc.applyResource("svc-a", { name: "svc-a", replicas: 1 });
    const result = svc.reconcile();
    expect(result.reconciled).toBe(1);
    expect(result.failed).toBe(0);
  });

  it("should return zero reconcile when no drift", () => {
    svc.setDesiredState({ manifests: [{ name: "svc-a" }], commitHash: "abc", branch: "main" });
    svc.sync();
    const result = svc.reconcile();
    expect(result.reconciled).toBe(0);
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    const { bootstrap } = await import("../src/index");
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});