/**
 * CodexvantaOS — module-suite / ModuleLoaderService
 * In-memory module loading and lifecycle management
 */

import type { Module } from "./types";

export class ModuleLoaderService {
  private modules = new Map<string, Module>();

  async load(name: string, version: string, exports: Record<string, unknown> = {}): Promise<Module> {
    const mod: Module = { name, version, status: "loaded", exports };
    this.modules.set(name, mod);
    return mod;
  }

  async unload(name: string): Promise<boolean> {
    const mod = this.modules.get(name);
    if (!mod) return false;
    mod.status = "unloaded";
    return true;
  }

  get(name: string): Module | null {
    return this.modules.get(name) ?? null;
  }

  list(): Module[] {
    return Array.from(this.modules.values());
  }

  listLoaded(): Module[] {
    return this.list().filter((m) => m.status === "loaded");
  }

  has(name: string): boolean {
    return this.modules.has(name);
  }
}