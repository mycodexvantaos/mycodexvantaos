import type { GatewayRoute, GatewayResponse } from "./types";

let counter = 0;

export class GatewayService {
  private routes = new Map<string, GatewayRoute & { id: string }>();

  addRoute(route: GatewayRoute): string {
    const id = `gw-${++counter}`;
    this.routes.set(id, { id, ...route });
    return id;
  }

  removeRoute(routeId: string): boolean {
    return this.routes.delete(routeId);
  }

  getRoute(routeId: string): (GatewayRoute & { id: string }) | null {
    return this.routes.get(routeId) ?? null;
  }

  listRoutes(): (GatewayRoute & { id: string })[] {
    return Array.from(this.routes.values());
  }

  match(path: string, method: string): (GatewayRoute & { id: string }) | null {
    for (const route of this.routes.values()) {
      if (route.path === path && route.method.toUpperCase() === method.toUpperCase()) {
        return route;
      }
    }
    // Prefix match fallback
    for (const route of this.routes.values()) {
      if (
        path.startsWith(route.path) &&
        route.method.toUpperCase() === method.toUpperCase()
      ) {
        return route;
      }
    }
    return null;
  }

  handle(path: string, method: string): GatewayResponse {
    const route = this.match(path, method);
    if (!route) {
      return {
        statusCode: 404,
        body: { error: "Route not found" },
        headers: { "content-type": "application/json" },
      };
    }
    return {
      statusCode: 200,
      body: { target: route.target, path, method, middleware: route.middleware },
      headers: { "content-type": "application/json", "x-gateway-route": route.id },
    };
  }
}