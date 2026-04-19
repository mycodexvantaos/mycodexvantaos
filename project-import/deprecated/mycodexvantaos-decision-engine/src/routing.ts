import type { RouteRule, RouteDecision } from "./types";
import { matchCondition } from "./utils/match";

let counter = 0;

export class RoutingService {
  private routes = new Map<string, RouteRule>();

  addRoute(route: Omit<RouteRule, "id">): RouteRule {
    const id = `route-${++counter}`;
    const full: RouteRule = { id, ...route };
    this.routes.set(id, full);
    return full;
  }

  removeRoute(routeId: string): boolean {
    return this.routes.delete(routeId);
  }

  getRoute(routeId: string): RouteRule | null {
    return this.routes.get(routeId) ?? null;
  }

  listRoutes(): RouteRule[] {
    return Array.from(this.routes.values()).sort(
      (a, b) => b.priority - a.priority,
    );
  }

  resolve(context: Record<string, unknown>): RouteDecision | null {
    const sorted = this.listRoutes();
    for (const rule of sorted) {
      if (matchCondition(rule.condition, context)) {
        return {
          target: rule.target,
          matchedRule: rule.id,
          confidence: rule.priority / 100,
        };
      }
    }
    return null;
  }

  resolveAll(context: Record<string, unknown>): RouteDecision[] {
    const sorted = this.listRoutes();
    const results: RouteDecision[] = [];
    for (const rule of sorted) {
      if (matchCondition(rule.condition, context)) {
        results.push({
          target: rule.target,
          matchedRule: rule.id,
          confidence: rule.priority / 100,
        });
      }
    }
    return results;
  }
}