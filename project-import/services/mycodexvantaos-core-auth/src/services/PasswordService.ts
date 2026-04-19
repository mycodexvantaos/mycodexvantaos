import { createHash, randomBytes } from "node:crypto";

export class PasswordService {
  hash(password: string): string {
    const salt = randomBytes(16).toString("hex");
    const hashed = createHash("sha256").update(salt + password).digest("hex");
    return salt + ":" + hashed;
  }

  verify(password: string, stored: string): boolean {
    const [salt, hashed] = stored.split(":");
    const computed = createHash("sha256").update(salt + password).digest("hex");
    return computed === hashed;
  }
}
