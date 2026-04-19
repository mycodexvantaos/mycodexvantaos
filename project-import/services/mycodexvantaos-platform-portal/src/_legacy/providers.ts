export interface PortalProvider {
  getAuthServiceUrl(): string;
}

export class DefaultPortalProvider implements PortalProvider {
  getAuthServiceUrl(): string {
    return process.env.AUTH_SERVICE_URL || "http://localhost:3001";
  }
}
