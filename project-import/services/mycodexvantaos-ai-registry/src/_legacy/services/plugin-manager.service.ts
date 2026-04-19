/**
 * CodexvantaOS — module-suite / PluginManagerService
 * Plugin discovery, installation, and lifecycle
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface Plugin { id: string; name: string; version: string; author?: string; description?: string; hooks: string[]; enabled: boolean; installedAt: number; config?: Record<string, unknown>; }

export class PluginManagerService {
  private plugins = new Map<string, Plugin>();
  private get providers() { return getProviders(); }

  async install(plugin: Omit<Plugin, 'id' | 'installedAt'>): Promise<Plugin> {
    const id = `plugin-${plugin.name}-${Date.now()}`;
    const entry: Plugin = { ...plugin, id, installedAt: Date.now() };
    this.plugins.set(id, entry);
    await this.providers.stateStore.set(`plugin:${id}`, entry);
    this.providers.observability.info('Plugin installed', { id, name: plugin.name });
    return entry;
  }

  async uninstall(pluginId: string): Promise<boolean> {
    this.plugins.delete(pluginId);
    return this.providers.stateStore.delete(`plugin:${pluginId}`);
  }

  async enable(pluginId: string): Promise<Plugin> { return this.toggle(pluginId, true); }
  async disable(pluginId: string): Promise<Plugin> { return this.toggle(pluginId, false); }

  async list(filter?: { enabled?: boolean; hook?: string }): Promise<Plugin[]> {
    if (this.plugins.size === 0) {
      const result = await this.providers.stateStore.scan<Plugin>({ pattern: 'plugin:*' });
      for (const e of result.entries) this.plugins.set(e.value.id, e.value);
    }
    let plugins = Array.from(this.plugins.values());
    if (filter?.enabled !== undefined) plugins = plugins.filter(p => p.enabled === filter.enabled);
    if (filter?.hook) plugins = plugins.filter(p => p.hooks.includes(filter.hook!));
    return plugins;
  }

  async executeHook(hookName: string, context: Record<string, unknown>): Promise<void> {
    const plugins = await this.list({ enabled: true, hook: hookName });
    for (const plugin of plugins) {
      await this.providers.queue.enqueue(`plugin:hook:${hookName}`, { pluginId: plugin.id, context, timestamp: Date.now() });
    }
  }

  private async toggle(pluginId: string, enabled: boolean): Promise<Plugin> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) throw new Error(`Plugin not found: ${pluginId}`);
    plugin.enabled = enabled;
    await this.providers.stateStore.set(`plugin:${pluginId}`, plugin);
    return plugin;
  }
}
