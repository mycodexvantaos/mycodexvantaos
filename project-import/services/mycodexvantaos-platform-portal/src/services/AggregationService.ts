export class AggregationService {
  async aggregate(): Promise<{ services: number; healthy: number }> {
    return {
      services: 1,
      healthy: 1
    };
  }
}
