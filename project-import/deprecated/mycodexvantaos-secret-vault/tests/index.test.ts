import { VaultService, EncryptionService, bootstrap } from "../src";

describe("VaultService", () => {
  let vault: VaultService;
  beforeEach(() => { vault = new VaultService(); });

  it("should set and get a secret", async () => {
    await vault.setSecret("API_KEY", "secret-123");
    const val = await vault.getSecret("API_KEY");
    expect(val).toBe("secret-123");
  });

  it("should return null for unknown secret", async () => {
    const val = await vault.getSecret("MISSING");
    expect(val).toBeNull();
  });

  it("should delete a secret", async () => {
    await vault.setSecret("TMP", "value");
    const deleted = await vault.deleteSecret("TMP");
    expect(deleted).toBe(true);
    expect(await vault.getSecret("TMP")).toBeNull();
  });

  it("should support scoped secrets", async () => {
    await vault.setSecret("DB_PASS", "prod-pw", { scope: "production" });
    await vault.setSecret("DB_PASS", "dev-pw", { scope: "development" });
    expect(await vault.getSecret("DB_PASS", "production")).toBe("prod-pw");
    expect(await vault.getSecret("DB_PASS", "development")).toBe("dev-pw");
  });

  it("should list secrets with optional scope filter", async () => {
    await vault.setSecret("A", "1", { scope: "global" });
    await vault.setSecret("B", "2", { scope: "global" });
    await vault.setSecret("C", "3", { scope: "staging" });
    const all = await vault.listSecrets();
    expect(all).toHaveLength(3);
    const globalOnly = await vault.listSecrets({ scope: "global" });
    expect(globalOnly).toHaveLength(2);
  });

  it("should rotate a secret and bump version", async () => {
    await vault.setSecret("KEY", "v1");
    const result = await vault.rotateSecret("KEY", "v2");
    expect(result.previousVersion).toBe(1);
    expect(result.newVersion).toBe(2);
    expect(await vault.getSecret("KEY")).toBe("v2");
  });
});

describe("EncryptionService", () => {
  let enc: EncryptionService;
  beforeEach(() => { enc = new EncryptionService(); });

  it("should encrypt and decrypt a string", () => {
    const plain = "hello secret world";
    const encrypted = enc.encrypt(plain);
    expect(encrypted).not.toBe(plain);
    expect(enc.decrypt(encrypted)).toBe(plain);
  });

  it("should produce deterministic hash", () => {
    const h1 = enc.hash("test");
    const h2 = enc.hash("test");
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64); // sha256 hex
  });

  it("should generate random tokens", () => {
    const t1 = enc.generateToken();
    const t2 = enc.generateToken();
    expect(t1).not.toBe(t2);
    expect(t1).toHaveLength(64); // 32 bytes hex
  });

  it("should derive key from password", () => {
    const { key, salt } = enc.deriveKey("mypassword");
    expect(key).toHaveLength(64);
    expect(salt).toBeDefined();
    // same password + same salt → same key
    const { key: key2 } = enc.deriveKey("mypassword", salt);
    expect(key2).toBe(key);
  });
});

describe("bootstrap", () => {
  it("should complete without error", async () => {
    await expect(bootstrap()).resolves.toBeUndefined();
  });
});