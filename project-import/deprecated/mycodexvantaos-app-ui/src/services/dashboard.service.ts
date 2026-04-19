export interface DashboardData {
  servicesCount: number;
  healthyCount: number;
  uptimeSeconds: number;
}

export class DashboardService {
  async getData(): Promise<DashboardData> {
    return {
      servicesCount: 0,
      healthyCount: 0,
      uptimeSeconds: 0,
    };
  }
}
