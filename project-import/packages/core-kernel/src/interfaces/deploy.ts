/**
 * CodexvantaOS — DeployProvider
 * 
 * Abstract interface for deployment orchestration.
 * Native mode: local Docker / process-based deployment (zero CI/CD dependency)
 * External mode: GitHub Actions, GitLab CI, AWS CodeDeploy, Vercel,
 *                Cloudflare Workers, Kubernetes, etc.
 * 
 * Covers: build triggering, deployment execution, rollback,
 *         environment management, deployment status tracking.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeploymentStatus =
  | 'pending'
  | 'queued'
  | 'building'
  | 'deploying'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'rolled_back';

export type DeployTarget =
  | 'local'
  | 'docker'
  | 'kubernetes'
  | 'serverless'
  | 'static'
  | 'vm'
  | 'custom';

export interface DeploymentInfo {
  id: string;
  repoName: string;
  ref: string;                 // branch, tag, or commit SHA
  environment: string;         // e.g. 'production', 'staging', 'preview'
  target: DeployTarget;
  status: DeploymentStatus;
  url?: string;                // deployed URL if applicable
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;           // ms
  version?: string;            // semantic version or build number
  actor?: string;              // who triggered the deploy
  logs?: string;               // log output or URL to logs
  metadata?: Record<string, unknown>;
}

export interface DeployInput {
  repoName: string;
  ref: string;
  environment: string;
  target?: DeployTarget;
  variables?: Record<string, string>;   // env vars for the build/deploy
  secrets?: string[];                    // secret keys to inject (resolved via SecretsProvider)
  dryRun?: boolean;
  timeout?: number;                      // max deploy time in seconds
  metadata?: Record<string, unknown>;
}

export interface BuildResult {
  success: boolean;
  artifacts: BuildArtifact[];
  logs: string;
  duration: number;            // ms
}

export interface BuildArtifact {
  name: string;
  path: string;
  size: number;                // bytes
  checksum?: string;
  contentType?: string;
}

export interface EnvironmentInfo {
  name: string;
  url?: string;
  active: boolean;
  protectionRules?: ProtectionRule[];
  variables?: Record<string, string>;
  lastDeployedAt?: number;
  lastDeploymentId?: string;
  createdAt: number;
}

export interface ProtectionRule {
  type: 'required_reviewers' | 'wait_timer' | 'branch_policy' | 'custom';
  config: Record<string, unknown>;
}

export interface RollbackOptions {
  targetDeploymentId?: string;   // roll back to specific deployment
  targetVersion?: string;        // roll back to specific version
  reason?: string;
}

export interface DeployListOptions {
  repoName?: string;
  environment?: string;
  status?: DeploymentStatus;
  since?: number;
  limit?: number;
  sort?: 'created' | 'completed';
  direction?: 'asc' | 'desc';
}

export interface DeployHealth {
  healthy: boolean;
  mode: 'native' | 'external';
  provider: string;
  activeDeployments?: number;
  queuedDeployments?: number;
  supportedTargets: DeployTarget[];
  details?: Record<string, unknown>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface DeployProvider {
  readonly providerId: string;
  readonly mode: 'native' | 'external';

  /** Initialise provider (auth, workspace setup, etc.) */
  init(): Promise<void>;

  // ── Deployment Lifecycle ────────────────────────────────────────────────

  /** Trigger a new deployment. Returns immediately with deployment info. */
  deploy(input: DeployInput): Promise<DeploymentInfo>;

  /** Get current status of a deployment. */
  getDeployment(deploymentId: string): Promise<DeploymentInfo | null>;

  /** List deployments matching filters. */
  listDeployments(options?: DeployListOptions): Promise<DeploymentInfo[]>;

  /** Cancel a pending or in-progress deployment. */
  cancel(deploymentId: string, reason?: string): Promise<DeploymentInfo>;

  /** Roll back to a previous deployment or version. */
  rollback(repoName: string, environment: string, options?: RollbackOptions): Promise<DeploymentInfo>;

  // ── Build ───────────────────────────────────────────────────────────────

  /** Trigger a build without deploying. Useful for CI validation. */
  build?(input: Omit<DeployInput, 'environment'>): Promise<BuildResult>;

  /** Retrieve build artifacts from a deployment. */
  getArtifacts?(deploymentId: string): Promise<BuildArtifact[]>;

  // ── Environment Management ──────────────────────────────────────────────

  /** List available deployment environments. */
  listEnvironments?(repoName?: string): Promise<EnvironmentInfo[]>;

  /** Create or update an environment configuration. */
  upsertEnvironment?(name: string, config: Partial<EnvironmentInfo>): Promise<EnvironmentInfo>;

  /** Delete an environment. */
  deleteEnvironment?(name: string): Promise<void>;

  // ── Streaming / Logs ────────────────────────────────────────────────────

  /** Stream deployment logs in real-time. Returns unsubscribe handle. */
  streamLogs?(deploymentId: string, handler: (line: string) => void): Promise<{ stop(): void }>;

  /** Get complete logs after deployment finishes. */
  getLogs?(deploymentId: string): Promise<string>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  healthcheck(): Promise<DeployHealth>;
  close(): Promise<void>;
}