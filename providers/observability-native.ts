import { ObservabilityProvider } from '@mycodexvantaos/core-kernel';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

export class NativeObservabilityProvider implements ObservabilityProvider {
  manifest = { capability: 'observability', provider: 'native-console', mode: 'native' as const };
  async initialize() {}
  async healthCheck() { return { status: 'healthy' as const }; }
  async shutdown() {}
  log(level: string, msg: string) { console.log(`[${level.toUpperCase()}] ${msg}`); }
  
  async publishMetrics(id: string, metrics: any) { 
    console.log(`[Metrics] Delegating publication for ${id} to publish-metrics.py...`);
    const tempFile = path.join(process.cwd(), `.temp-metrics-${id}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(metrics, null, 2), 'utf8');

    const scriptPath = path.join(process.cwd(), 'vector-store', 'retrieval-pipelines', 'src', 'publish-metrics.py');
    exec(`python3 "${scriptPath}" --execution-id="${id}" --state-file="${tempFile}"`, (error, stdout, stderr) => {
      if (error) {
         console.error(`[Metrics Error] Failed to run publish-metrics.py: ${error.message}`);
         return;
      }
      if (stderr) console.error(`[Metrics Stderr] ${stderr}`);
      console.log(stdout.trim());
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
    });
  }
}
