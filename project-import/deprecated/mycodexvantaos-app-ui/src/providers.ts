export interface UIProvider {
  getApiUrl(): string;
}

export class DefaultUIProvider implements UIProvider {
  getApiUrl(): string {
    return import.meta.env.VITE_API_URL || "http://localhost:3002";
  }
}
