import type { Permission } from "../types/auth.types";

export class RbacService {
  private permissions = new Map<string, Permission[]>();

  grant(role: string, permission: Permission): void {
    const current = this.permissions.get(role) || [];
    current.push(permission);
    this.permissions.set(role, current);
  }

  check(role: string, resource: string, action: string): boolean {
    const current = this.permissions.get(role) || [];
    return current.some((p) => p.resource === resource && p.action === action);
  }
}
