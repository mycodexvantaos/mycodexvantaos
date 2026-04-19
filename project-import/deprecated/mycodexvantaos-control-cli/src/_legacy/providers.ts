export interface CLIProvider {
  getApiUrl(): string;
}

export class DefaultCLIProvider implements CLIProvider {
  getApiUrl(): string {
    return process.env.CODEXVANTA_API_URL || "http://localhost:3002";
  }
}
