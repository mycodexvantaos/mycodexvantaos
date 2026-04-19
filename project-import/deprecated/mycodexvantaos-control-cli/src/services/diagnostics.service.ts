export interface DiagnosticResult {
  name: string;
  status: "pass" | "fail" | "warn";
  message: string;
}

export class DiagnosticsService {
  async runAll(): Promise<DiagnosticResult[]> {
    return [
      { name: "node-version", status: "pass", message: process.version },
      { name: "platform", status: "pass", message: process.platform },
    ];
  }
}
