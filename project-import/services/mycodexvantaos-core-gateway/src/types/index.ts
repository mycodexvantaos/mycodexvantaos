export interface PlatformConfig {
  port: number;
  logLevel: string;
  env: string;
}

export interface ServiceStatus {
  name: string;
  healthy: boolean;
  uptime: number;
}
