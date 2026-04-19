export class AuthorizationService {
  private policies = new Map<string, Set<string>>();

  addPolicy(role: string, permission: string): void {
    const perms = this.policies.get(role) || new Set();
    perms.add(permission);
    this.policies.set(role, perms);
  }

  isAllowed(role: string, permission: string): boolean {
    const perms = this.policies.get(role);
    return perms ? perms.has(permission) : false;
  }
}
