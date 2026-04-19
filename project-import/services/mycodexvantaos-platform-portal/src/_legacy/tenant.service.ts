import { randomUUID } from 'node:crypto';
export interface Tenant {
  id: string;
  name: string;
  active: boolean;
}

export class TenantService {
  private tenants = new Map<string, Tenant>();

  create(name: string): Tenant {
    const tenant: Tenant = {
      id: randomUUID().replace(/-/g, ''),
      name,
      active: true,
    };
    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  get(id: string): Tenant | null {
    return this.tenants.get(id) || null;
  }

  list(): Tenant[] {
    return Array.from(this.tenants.values());
  }
}
