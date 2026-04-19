export class AppPortalService {
  async getPortalConfig(): Promise<Record<string, unknown>> {
    return {
      name: "CodexvantaOS Portal",
      version: "0.1.0",
    };
  }
}
