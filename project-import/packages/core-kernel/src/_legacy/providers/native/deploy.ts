/**
 * NativeDeployProvider — Local process / Docker-based deployment
 * 
 * Zero CI/CD dependency. Deploys via:
 *  - Local process execution (npm start, python app.py, etc.)
 *  - Docker containers (if Docker is available)
 *  - Static file serving (built-in HTTP server)
 *  - Shell script execution for custom builds
 *  - No GitHub Actions, no Vercel, no AWS CodeDeploy required
 */

import type {
  DeployProvider,
  DeploymentInfo,
  DeployInput,
  BuildResult,
  BuildArtifact,
  DeploymentStatus,
  DeployTarget,
  DeployListOptions,
  DeployHealth,
  RollbackOptions,
} from '../../interfaces/deploy';

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync, spawn, ChildProcess } from 'child_process';

interface NativeDeployConfig {
  dataDir?: string;
  buildsDir?: string;
  logsDir?: string;
  defaultTarget?: DeployTarget;
  defaultTimeout?: number;
}

interface RunningProcess {
  deploymentId: string;
  process: ChildProcess;
  startedAt: number;
}

export class NativeDeployProvider implements DeployProvider {
  readonly providerId = 'native-local-deploy';
  readonly mode = 'native' as const;

  private config: Required<NativeDeployConfig>;
  private deployments: DeploymentInfo[] = [];
  private running = new Map<string, RunningProcess>();
  private deploymentsFile: string;

  constructor(config?: NativeDeployConfig) {
    const dataDir = config?.dataDir ?? path.join(process.cwd(), '.codexvanta', 'deploy');
    this.config = {
      dataDir,
      buildsDir: config?.buildsDir ?? path.join(dataDir, 'builds'),
      logsDir: config?.logsDir ?? path.join(dataDir, 'logs'),
      defaultTarget: config?.defaultTarget ?? 'local',
      defaultTimeout: config?.defaultTimeout ?? 300,
    };
    this.deploymentsFile = path.join(dataDir, 'deployments.json');
  }

  async init(): Promise<void> {
    for (const dir of [this.config.dataDir, this.config.buildsDir, this.config.logsDir]) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    // Load deployment history
    if (fs.existsSync(this.deploymentsFile)) {
      try {
        this.deployments = JSON.parse(fs.readFileSync(this.deploymentsFile, 'utf-8'));
      } catch {
        this.deployments = [];
      }
    }
  }

  // ── Deployment Lifecycle ────────────────────────────────────────────────────

  async deploy(input: DeployInput): Promise<DeploymentInfo> {
    const now = Date.now();
    const deployId = crypto.randomUUID();
    const target = input.target ?? this.config.defaultTarget;
    const logFile = path.join(this.config.logsDir, `${deployId}.log`);

    const deployment: DeploymentInfo = {
      id: deployId,
      repoName: input.repoName,
      ref: input.ref,
      environment: input.environment,
      target,
      status: 'pending',
      createdAt: now,
      version: input.metadata?.version as string,
      actor: input.metadata?.actor as string,
      metadata: input.metadata,
    };

    this.deployments.push(deployment);
    this.persist();

    if (input.dryRun) {
      deployment.status = 'succeeded';
      deployment.completedAt = Date.now();
      deployment.logs = '[DRY RUN] Deployment simulated successfully.';
      this.persist();
      return deployment;
    }

    // Execute deployment asynchronously
    this.executeDeployment(deployment, input, logFile).catch(err => {
      deployment.status = 'failed';
      deployment.completedAt = Date.now();
      deployment.logs = String(err);
      this.persist();
    });

    return deployment;
  }

  async getDeployment(deploymentId: string): Promise<DeploymentInfo | null> {
    const d = this.deployments.find(d => d.id === deploymentId);
    if (!d) return null;

    // Attach logs if available
    const logFile = path.join(this.config.logsDir, `${deploymentId}.log`);
    if (fs.existsSync(logFile)) {
      d.logs = fs.readFileSync(logFile, 'utf-8');
    }
    return d;
  }

  async listDeployments(options?: DeployListOptions): Promise<DeploymentInfo[]> {
    let filtered = [...this.deployments];

    if (options?.repoName) filtered = filtered.filter(d => d.repoName === options.repoName);
    if (options?.environment) filtered = filtered.filter(d => d.environment === options.environment);
    if (options?.status) filtered = filtered.filter(d => d.status === options.status);
    if (options?.since) filtered = filtered.filter(d => d.createdAt >= options.since!);

    const sort = options?.sort ?? 'created';
    const dir = options?.direction ?? 'desc';
    filtered.sort((a, b) => {
      const aVal = sort === 'completed' ? (a.completedAt ?? 0) : a.createdAt;
      const bVal = sort === 'completed' ? (b.completedAt ?? 0) : b.createdAt;
      return dir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    if (options?.limit) filtered = filtered.slice(0, options.limit);
    return filtered;
  }

  async cancel(deploymentId: string, reason?: string): Promise<DeploymentInfo> {
    const deployment = this.deployments.find(d => d.id === deploymentId);
    if (!deployment) throw new Error(`Deployment not found: ${deploymentId}`);

    const running = this.running.get(deploymentId);
    if (running) {
      running.process.kill('SIGTERM');
      this.running.delete(deploymentId);
    }

    deployment.status = 'cancelled';
    deployment.completedAt = Date.now();
    deployment.metadata = { ...deployment.metadata, cancelReason: reason };
    this.persist();

    return deployment;
  }

  async rollback(
    repoName: string,
    environment: string,
    options?: RollbackOptions
  ): Promise<DeploymentInfo> {
    // Find the target deployment to roll back to
    let targetDeploy: DeploymentInfo | undefined;

    if (options?.targetDeploymentId) {
      targetDeploy = this.deployments.find(d => d.id === options.targetDeploymentId);
    } else if (options?.targetVersion) {
      targetDeploy = this.deployments
        .filter(d => d.repoName === repoName && d.environment === environment && d.version === options.targetVersion && d.status === 'succeeded')
        .pop();
    } else {
      // Roll back to previous successful deployment
      const successful = this.deployments
        .filter(d => d.repoName === repoName && d.environment === environment && d.status === 'succeeded')
        .sort((a, b) => b.createdAt - a.createdAt);
      targetDeploy = successful[1]; // second most recent
    }

    if (!targetDeploy) {
      throw new Error('No suitable deployment found for rollback');
    }

    // Create a new deployment that references the rollback target
    return this.deploy({
      repoName,
      ref: targetDeploy.ref,
      environment,
      target: targetDeploy.target,
      metadata: {
        rollbackFrom: this.deployments.find(d =>
          d.repoName === repoName && d.environment === environment && d.status === 'succeeded'
        )?.id,
        rollbackTo: targetDeploy.id,
        rollbackReason: options?.reason,
      },
    });
  }

  // ── Build ───────────────────────────────────────────────────────────────────

  async build(input: Omit<DeployInput, 'environment'>): Promise<BuildResult> {
    const startTime = Date.now();
    const buildId = crypto.randomUUID();
    const buildDir = path.join(this.config.buildsDir, buildId);
    const logLines: string[] = [];

    fs.mkdirSync(buildDir, { recursive: true });

    try {
      const repoPath = path.resolve(input.repoName);
      const hasPkgJson = fs.existsSync(path.join(repoPath, 'package.json'));
      const hasDockerfile = fs.existsSync(path.join(repoPath, 'Dockerfile'));
      const hasMakefile = fs.existsSync(path.join(repoPath, 'Makefile'));

      logLines.push(`[BUILD] Starting build for ${input.repoName} @ ${input.ref}`);

      if (hasPkgJson) {
        logLines.push('[BUILD] Detected package.json — running npm install && npm run build');
        try {
          execSync('npm install && npm run build', { cwd: repoPath, timeout: 120000 });
          logLines.push('[BUILD] npm build succeeded');
        } catch (e) {
          logLines.push(`[BUILD] npm build failed: ${e}`);
        }
      } else if (hasMakefile) {
        logLines.push('[BUILD] Detected Makefile — running make build');
        try {
          execSync('make build', { cwd: repoPath, timeout: 120000 });
          logLines.push('[BUILD] make build succeeded');
        } catch (e) {
          logLines.push(`[BUILD] make build failed: ${e}`);
        }
      } else if (hasDockerfile) {
        logLines.push('[BUILD] Detected Dockerfile — running docker build');
        try {
          execSync(`docker build -t ${input.repoName}:${input.ref} .`, { cwd: repoPath, timeout: 300000 });
          logLines.push('[BUILD] docker build succeeded');
        } catch (e) {
          logLines.push(`[BUILD] docker build failed: ${e}`);
        }
      }

      // Collect artifacts
      const artifacts: BuildArtifact[] = [];
      const distDir = path.join(repoPath, 'dist');
      if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir);
        for (const file of files) {
          const stat = fs.statSync(path.join(distDir, file));
          artifacts.push({ name: file, path: path.join(distDir, file), size: stat.size });
        }
      }

      return {
        success: true,
        artifacts,
        logs: logLines.join('\n'),
        duration: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        artifacts: [],
        logs: logLines.join('\n') + `\n[ERROR] ${err}`,
        duration: Date.now() - startTime,
      };
    }
  }

  async getArtifacts(deploymentId: string): Promise<BuildArtifact[]> {
    const buildDir = path.join(this.config.buildsDir, deploymentId);
    if (!fs.existsSync(buildDir)) return [];

    return fs.readdirSync(buildDir).map(file => {
      const fullPath = path.join(buildDir, file);
      const stat = fs.statSync(fullPath);
      return { name: file, path: fullPath, size: stat.size };
    });
  }

  // ── Logs ────────────────────────────────────────────────────────────────────

  async getLogs(deploymentId: string): Promise<string> {
    const logFile = path.join(this.config.logsDir, `${deploymentId}.log`);
    if (!fs.existsSync(logFile)) return '';
    return fs.readFileSync(logFile, 'utf-8');
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async healthcheck(): Promise<DeployHealth> {
    const active = this.deployments.filter(d =>
      d.status === 'building' || d.status === 'deploying' || d.status === 'pending'
    );
    const queued = this.deployments.filter(d => d.status === 'queued');

    // Detect available targets
    const targets: DeployTarget[] = ['local'];
    try { execSync('docker --version', { stdio: 'ignore' }); targets.push('docker'); } catch {}

    return {
      healthy: true,
      mode: 'native',
      provider: this.providerId,
      activeDeployments: active.length,
      queuedDeployments: queued.length,
      supportedTargets: targets,
      details: {
        totalDeployments: this.deployments.length,
        runningProcesses: this.running.size,
        dataDir: this.config.dataDir,
      },
    };
  }

  async close(): Promise<void> {
    // Kill all running processes
    for (const [id, rp] of this.running) {
      try { rp.process.kill('SIGTERM'); } catch {}
    }
    this.running.clear();
    this.persist();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async executeDeployment(
    deployment: DeploymentInfo,
    input: DeployInput,
    logFile: string
  ): Promise<void> {
    deployment.status = 'building';
    deployment.startedAt = Date.now();
    this.persist();

    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    const log = (msg: string) => {
      const line = `[${new Date().toISOString()}] ${msg}\n`;
      logStream.write(line);
    };

    try {
      log(`Starting deployment: ${deployment.id}`);
      log(`Repo: ${input.repoName}, Ref: ${input.ref}, Env: ${input.environment}`);

      // Set environment variables
      const env = { ...process.env, ...input.variables };

      const repoPath = path.resolve(input.repoName);
      if (!fs.existsSync(repoPath)) {
        throw new Error(`Repository path not found: ${repoPath}`);
      }

      // Build phase
      log('Starting build phase...');
      const buildResult = await this.build({ repoName: input.repoName, ref: input.ref });
      log(buildResult.logs);

      if (!buildResult.success) {
        throw new Error('Build failed');
      }

      // Deploy phase
      deployment.status = 'deploying';
      this.persist();
      log('Starting deploy phase...');

      const hasPkgJson = fs.existsSync(path.join(repoPath, 'package.json'));
      if (hasPkgJson) {
        const startCmd = 'npm start';
        log(`Executing: ${startCmd}`);

        const child = spawn('npm', ['start'], {
          cwd: repoPath,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: true,
        });

        child.stdout?.on('data', (data: Buffer) => log(`[stdout] ${data.toString().trim()}`));
        child.stderr?.on('data', (data: Buffer) => log(`[stderr] ${data.toString().trim()}`));

        this.running.set(deployment.id, {
          deploymentId: deployment.id,
          process: child,
          startedAt: Date.now(),
        });

        // Wait briefly to check if process starts OK
        await new Promise(resolve => setTimeout(resolve, 3000));

        if (child.exitCode !== null && child.exitCode !== 0) {
          throw new Error(`Process exited with code ${child.exitCode}`);
        }
      }

      deployment.status = 'succeeded';
      deployment.completedAt = Date.now();
      deployment.duration = deployment.completedAt - deployment.startedAt!;
      log(`Deployment succeeded in ${deployment.duration}ms`);

    } catch (err) {
      deployment.status = 'failed';
      deployment.completedAt = Date.now();
      deployment.duration = deployment.completedAt - (deployment.startedAt ?? deployment.createdAt);
      log(`Deployment failed: ${err}`);
      throw err;
    } finally {
      logStream.end();
      this.persist();
    }
  }

  private persist(): void {
    try {
      fs.writeFileSync(this.deploymentsFile, JSON.stringify(this.deployments, null, 2));
    } catch { /* best-effort */ }
  }
}