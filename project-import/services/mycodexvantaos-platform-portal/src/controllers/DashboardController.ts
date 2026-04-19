export class DashboardController {
  async summary(): Promise<{ services: number; healthy: number }> {
    return {
      services: 1,
      healthy: 1
    };
  }
}
