/**
 * CodexvantaOS — network-mesh / GatewayService
 * API gateway and routing
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface Route { path: string; service: string; methods: string[]; middlewares: string[]; rateLimit?: number; authRequired: boolean; }

export class GatewayService {
  private routes = new Map<string, Route>();
  private get providers() { return getProviders(); }

  async addRoute(route: Route): Promise<void> {
    this.routes.set(route.path, route);
    await this.providers.stateStore.set(`mesh:route:${route.path}`, route);
    this.providers.observability.info('Route added', { path: route.path, service: route.service });
  }

  async removeRoute(path: string): Promise<boolean> {
    this.routes.delete(path);
    return this.providers.stateStore.delete(`mesh:route:${path}`);
  }

  async resolve(path: string, method: string): Promise<Route | null> {
    for (const [routePath, route] of this.routes) {
      if (this.matchPath(path, routePath) && (route.methods.includes('*') || route.methods.includes(method.toUpperCase()))) return route;
    }
    return null;
  }

  async listRoutes(): Promise<Route[]> {
    if (this.routes.size === 0) {
      const result = await this.providers.stateStore.scan<Route>({ pattern: 'mesh:route:*' });
      for (const e of result.entries) this.routes.set(e.value.path, e.value);
    }
    return Array.from(this.routes.values());
  }

  async checkRateLimit(path: string, clientId: string): Promise<boolean> {
    const route = this.routes.get(path);
    if (!route?.rateLimit) return true;
    const key = `mesh:ratelimit:${path}:${clientId}`;
    const current = await this.providers.stateStore.increment(key);
    if (current === 1) await this.providers.stateStore.set(key, 1, { ttl: 60 });
    return current <= route.rateLimit;
  }

  private matchPath(actual: string, pattern: string): boolean {
    if (pattern === actual) return true;
    const patternParts = pattern.split('/'); const actualParts = actual.split('/');
    if (patternParts.length !== actualParts.length) return false;
    return patternParts.every((part, i) => part.startsWith(':') || part === actualParts[i]);
  }
}
