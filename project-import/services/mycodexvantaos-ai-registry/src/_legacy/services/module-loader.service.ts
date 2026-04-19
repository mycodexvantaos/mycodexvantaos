/**
 * CodexvantaOS — module-suite / ModuleLoaderService
 * Dynamic module loading and lifecycle management
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface ModuleDescriptor { name: string; version: string; entryPoint: string; dependencies: string[]; description?: string; enabled: boolean; loadedAt?: number; }

export class ModuleLoaderService {
  private modules = new Map<string, ModuleDescriptor>();
  private instances = new Map<string, unknown>();
  private get providers() { return getProviders(); }

  async register(descriptor: Omit<ModuleDescriptor, 'loadedAt'>): Promise<ModuleDescriptor> {
    const mod: ModuleDescriptor = { ...descriptor, loadedAt: undefined };
    this.modules.set(descriptor.name, mod);
    await this.providers.stateStore.set(`module:descriptor:${descriptor.name}`, mod);
    this.providers.observability.info('Module registered', { module: descriptor.name, version: descriptor.version });
    return mod;
  }

  async load(name: string): Promise<unknown> {
    const descriptor = this.modules.get(name);
    if (!descriptor) throw new Error(`Module not registered: ${name}`);
    if (!descriptor.enabled) throw new Error(`Module disabled: ${name}`);
    for (const dep of descriptor.dependencies) {
      if (!this.instances.has(dep)) await this.load(dep);
    }
    try {
      const instance = await import(descriptor.entryPoint);
      this.instances.set(name, instance);
      descriptor.loadedAt = Date.now();
      await this.providers.stateStore.set(`module:descriptor:${name}`, descriptor);
      this.providers.observability.info('Module loaded', { module: name });
      return instance;
    } catch (err) { this.providers.observability.error('Module load failed', { module: name, error: String(err) }); throw err; }
  }

  async unload(name: string): Promise<void> {
    this.instances.delete(name);
    const descriptor = this.modules.get(name);
    if (descriptor) { descriptor.loadedAt = undefined; await this.providers.stateStore.set(`module:descriptor:${name}`, descriptor); }
  }

  getInstance(name: string): unknown { return this.instances.get(name) ?? null; }
  listModules(): ModuleDescriptor[] { return Array.from(this.modules.values()); }
  isLoaded(name: string): boolean { return this.instances.has(name); }
}
