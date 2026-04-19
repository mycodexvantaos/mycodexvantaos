export interface UIConfig {
  apiUrl: string;
  appTitle: string;
}

export class UIConfigService {
  getConfig(): UIConfig {
    return {
      apiUrl: import.meta.env.VITE_API_URL || "http://localhost:3002",
      appTitle: "CodexvantaOS",
    };
  }
}
