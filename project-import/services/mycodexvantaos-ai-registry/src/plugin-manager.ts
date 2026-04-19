/**
 * CodexvantaOS — module-suite / PluginManagerService
 * In-memory plugin registration and lifecycle
 */

import type { Plugin } from "./types";

export class PluginManagerService {
  private plugins = new Map<string, Plugin>();

  register(plugin: Omit<Plugin, "id">): Plugin {
    const id = `plugin-${plugin.name}-${Date.now()}`;
    const entry: Plugin = { id, ...plugin };
    this.plugins.set(id, entry);
    return entry;
  }

  unregister(pluginId: string): boolean {
    return this.plugins.delete(pluginId);
  }

  enable(pluginId: string): Plugin {
    const p = this.plugins.get(pluginId);
    if (!p) throw new Error(`Plugin not found: ${pluginId}`);
    p.enabled = true;
    return p;
  }

  disable(pluginId: string): Plugin {
    const p = this.plugins.get(pluginId);
    if (!p) throw new Error(`Plugin not found: ${pluginId}`);
    p.enabled = false;
    return p;
  }

  get(pluginId: string): Plugin | null {
    return this.plugins.get(pluginId) ?? null;
  }

  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  listEnabled(): Plugin[] {
    return this.list().filter((p) => p.enabled);
  }
}