import * as k8s from '@kubernetes/client-node';
  import * as yamlLib from 'js-yaml';
  import * as fs from 'fs';
  import pino from 'pino';

  import type {
    SyncResult,
    DesiredState,
    ActualState,
    DriftReport,
    DriftItem,
    ReconcileResult,
  } from './types';

  const logger = pino({ name: 'gitops-sync' });

  /** Represents a live k8s resource snapshot */
  export interface ResourceSnapshot {
    kind: string;
    name: string;
    namespace: string;
    image?: string;
    replicas?: number;
    readyReplicas?: number;
  }

  export class GitOpsSyncService {
    private kc: k8s.KubeConfig;
    private client: k8s.KubernetesObjectApi;
    private appsApi: k8s.AppsV1Api;
    private desiredState: DesiredState | null = null;
    private readonly namespace: string;
    private readonly fieldManager = 'mycodexvantaos-gitops';
    private k8sAvailable = false;

    constructor(namespace = 'mycodexvantaos') {
      this.namespace = namespace;
      this.kc = new k8s.KubeConfig();

      // Try in-cluster first (running as a pod), then fall back to kubeconfig file
      try {
        this.kc.loadFromCluster();
        this.k8sAvailable = true;
        logger.info('Loaded kubeconfig from in-cluster service account');
      } catch {
        try {
          this.kc.loadFromDefault();
          this.k8sAvailable = true;
          logger.info('Loaded kubeconfig from default path');
        } catch (e) {
          logger.warn({ err: e }, 'No kubeconfig found — operating in dry-run mode');
          this.k8sAvailable = false;
        }
      }

      this.client = k8s.KubernetesObjectApi.makeApiClient(this.kc);
      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    }

    setDesiredState(state: DesiredState): void {
      this.desiredState = state;
    }

    getDesiredState(): DesiredState | null {
      return this.desiredState;
    }

    /**
     * Apply a single Kubernetes manifest using Server-Side Apply.
     * SSA is idempotent and does not require reading the resource first.
     */
    async applyManifest(manifest: k8s.KubernetesObject): Promise<void> {
      if (!this.k8sAvailable) {
        logger.info({ kind: manifest.kind, name: manifest.metadata?.name }, '[DRY-RUN] would apply manifest');
        return;
      }
      await this.client.patch(
        manifest,
        undefined,          // pretty
        undefined,          // dryRun
        this.fieldManager,  // fieldManager — controller identity
        true,               // force — override field conflicts (correct for controllers)
        { headers: { 'Content-Type': 'application/apply-patch+yaml' } },
      );
      logger.info({ kind: manifest.kind, name: manifest.metadata?.name }, 'Applied manifest');
    }

    /**
     * Apply all YAML documents from a file (supports multi-doc YAML with ---)
     */
    async applyManifestFile(filePath: string): Promise<{ applied: number; errors: string[] }> {
      const raw = fs.readFileSync(filePath, 'utf8');
      const docs = yamlLib.loadAll(raw) as k8s.KubernetesObject[];
      let applied = 0;
      const errors: string[] = [];
      for (const manifest of docs) {
        if (!manifest || !manifest.kind) continue;
        try {
          await this.applyManifest(manifest);
          applied++;
        } catch (e: unknown) {
          errors.push(`${manifest.kind}/${manifest.metadata?.name}: ${String(e)}`);
        }
      }
      return { applied, errors };
    }

    /**
     * Apply all YAML manifests in a directory recursively
     */
    async applyDirectory(dirPath: string): Promise<{ applied: number; errors: string[] }> {
      if (!fs.existsSync(dirPath)) {
        return { applied: 0, errors: [`Directory not found: ${dirPath}`] };
      }
      let applied = 0;
      const errors: string[] = [];
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        if (entry.isDirectory()) {
          const sub = await this.applyDirectory(fullPath);
          applied += sub.applied;
          errors.push(...sub.errors);
        } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
          const result = await this.applyManifestFile(fullPath);
          applied += result.applied;
          errors.push(...result.errors);
        }
      }
      return { applied, errors };
    }

    /**
     * Fetch the actual state from the live k8s cluster in our namespace.
     * Returns empty list when k8s is unavailable.
     */
    async getActualState(): Promise<ActualState> {
      const resources: ResourceSnapshot[] = [];
      if (!this.k8sAvailable) {
        return { resources, lastSyncedAt: new Date() };
      }
      try {
        const deploys = await this.appsApi.listNamespacedDeployment({ namespace: this.namespace });
        for (const d of deploys.items) {
          resources.push({
            kind: 'Deployment',
            name: d.metadata?.name ?? '',
            namespace: d.metadata?.namespace ?? '',
            replicas: d.spec?.replicas ?? 0,
            readyReplicas: d.status?.readyReplicas ?? 0,
            image: d.spec?.template.spec?.containers?.[0]?.image,
          });
        }
      } catch (e: unknown) {
        logger.warn({ err: e }, 'Failed to list Deployments from cluster');
      }
      return { resources, lastSyncedAt: new Date() };
    }

    /**
     * Apply all manifests in the desired state to the cluster.
     */
    async sync(): Promise<SyncResult> {
      if (!this.desiredState) {
        return { synced: false, changes: 0, errors: ['No desired state configured'] };
      }
      let changes = 0;
      const errors: string[] = [];
      for (const manifest of this.desiredState.manifests as k8s.KubernetesObject[]) {
        try {
          await this.applyManifest(manifest);
          changes++;
        } catch (e: unknown) {
          errors.push(`Failed to apply ${manifest.kind}/${manifest.metadata?.name}: ${String(e)}`);
        }
      }
      return { synced: errors.length === 0, changes, errors };
    }

    /**
     * Detect drift between desired and actual state.
     * Drift = a resource in desired state that is missing or different in the cluster.
     */
    async detectDrift(): Promise<DriftReport> {
      const drifts: DriftItem[] = [];
      if (!this.desiredState) {
        return { hasDrift: false, drifts, checkedAt: new Date() };
      }
      const actual = await this.getActualState();
      const actualByKey = new Map<string, ResourceSnapshot>(
        (actual.resources as ResourceSnapshot[]).map(r => [`${r.kind}/${r.name}`, r])
      );

      for (const manifest of this.desiredState.manifests as k8s.KubernetesObject[]) {
        const key = `${manifest.kind}/${manifest.metadata?.name}`;
        const live = actualByKey.get(key);
        if (!live) {
          drifts.push({ resource: key, field: '*', expected: manifest, actual: null });
          continue;
        }
        // Check image drift on Deployments
        if (manifest.kind === 'Deployment') {
          const desiredImage = (manifest as k8s.V1Deployment).spec?.template.spec?.containers?.[0]?.image;
          if (desiredImage && desiredImage !== live.image) {
            drifts.push({ resource: key, field: 'spec.template.spec.containers[0].image', expected: desiredImage, actual: live.image ?? null });
          }
        }
      }

      return { hasDrift: drifts.length > 0, drifts, checkedAt: new Date() };
    }

    /**
     * Reconcile: detect drift then apply any missing/drifted resources.
     */
    async reconcile(): Promise<ReconcileResult> {
      const drift = await this.detectDrift();
      if (!drift.hasDrift) {
        logger.info('No drift detected — cluster in desired state');
        return { reconciled: 0, failed: 0, errors: [] };
      }
      logger.info({ driftCount: drift.drifts.length }, 'Drift detected — starting reconciliation');
      const syncResult = await this.sync();
      return {
        reconciled: syncResult.changes,
        failed: syncResult.errors.length,
        errors: syncResult.errors,
      };
    }
  }
  