export class ApiClient {
  constructor(private baseUrl: string) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(this.baseUrl + path);
    if (!response.ok) {
      throw new Error("API error: " + response.statusText);
    }
    return response.json() as Promise<T>;
  }
}
