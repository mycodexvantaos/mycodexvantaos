/**
 * CodexvantaOS — infra-gitops / GitOpsService
 * Declarative GitOps deployment operations
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface DeploymentSpec { repo: string; ref: string; environment: string; strategy: 'rolling' | 'blue-green' | 'canary'; autoDeploy: boolean; }

export class GitOpsService {
  private get providers() { return getProviders(); }

  async reconcile(repo: string, environment: string): Promise<{ status: string; changes: string[] }> {
    const spec = await this.getSpec(repo, environment);
    if (!spec) throw new Error(`No deployment spec for ${repo}/${environment}`);
    const currentState = await this.providers.deploy.listDeployments({ repoName: repo, environment, limit: 1 });
    const latestCommits = await this.providers.repo.listCommits(repo, { branch: spec.ref, limit: 1 });
    if (latestCommits.length === 0) return { status: 'up-to-date', changes: [] };
    const latestSha = latestCommits[0].sha;
    if (currentState.length > 0 && currentState[0].ref === latestSha) return { status: 'up-to-date', changes: [] };
    if (spec.autoDeploy) {
      await this.providers.deploy.deploy({ repoName: repo, ref: latestSha, environment });
      this.providers.observability.info('GitOps auto-deploy triggered', { repo, ref: latestSha, environment });
      return { status: 'deployed', changes: [`Deployed ${latestSha.slice(0, 8)}`] };
    }
    return { status: 'pending', changes: [`New commit: ${latestSha.slice(0, 8)}`] };
  }

  async setSpec(spec: DeploymentSpec): Promise<void> {
    await this.providers.stateStore.set(`gitops:spec:${spec.repo}:${spec.environment}`, spec);
  }

  async getSpec(repo: string, environment: string): Promise<DeploymentSpec | null> {
    const entry = await this.providers.stateStore.get<DeploymentSpec>(`gitops:spec:${repo}:${environment}`);
    return entry?.value ?? null;
  }

  async listSpecs(): Promise<DeploymentSpec[]> {
    const result = await this.providers.stateStore.scan<DeploymentSpec>({ pattern: 'gitops:spec:*' });
    return result.entries.map(e => e.value);
  }
}
