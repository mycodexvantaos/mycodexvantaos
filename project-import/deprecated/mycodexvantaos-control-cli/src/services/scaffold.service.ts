import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export class ScaffoldService {
  create(targetDir: string, name: string): void {
    const dir = join(targetDir, name);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const pkgPath = join(dir, "package.json");
    if (!existsSync(pkgPath)) {
      writeFileSync(
        pkgPath,
        JSON.stringify({ name, version: "0.1.0", private: true }, null, 2)
      );
    }
  }
}
