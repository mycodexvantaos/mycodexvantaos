export interface MarketplaceItem {
  id: string;
  name: string;
  version: string;
}

export class MarketplaceService {
  async list(): Promise<MarketplaceItem[]> {
    return [];
  }

  async install(id: string): Promise<boolean> {
    return id.length > 0;
  }
}
