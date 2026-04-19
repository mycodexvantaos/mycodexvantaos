import type { OrchestrationResult, OrchestrationStatus, RepoEntry } from "./types";

export class OrchestrationService {
  private repos = new Map<string, RepoEntry>();
  private phase = "idle";
  private currentTier = 0;

  registerRepo(entry: RepoEntry): void {
    this.repos.set(entry.name, { ...entry });
  }

  unregisterRepo(name: string): boolean {
    return this.repos.delete(name);
  }

  getRepo(name: string): RepoEntry | null {
    return this.repos.get(name) ?? null;
  }

  listRepos(): RepoEntry[] {
    return Array.from(this.repos.values()).sort((a, b) => a.tier - b.tier);
  }

  listByTier(tier: number): RepoEntry[] {
    return this.listRepos().filter((r) => r.tier === tier);
  }

  orchestrate(): OrchestrationResult {
    const startTime = Date.now();
    const failures: string[] = [];
    this.phase = "running";

    const maxTier = Math.max(...Array.from(this.repos.values()).map((r) => r.tier), 0);
    for (let tier = 0; tier <= maxTier; tier++) {
      this.currentTier = tier;
      const tierRepos = this.listByTier(tier);
      for (const repo of tierRepos) {
        repo.status = "processed";
        this.repos.set(repo.name, repo);
      }
    }

    this.phase = "completed";
    return {
      success: failures.length === 0,
      reposProcessed: this.repos.size,
      failures,
      duration: Date.now() - startTime,
    };
  }

  getStatus(): OrchestrationStatus {
    const repoStatuses: Record<string, string> = {};
    for (const [name, repo] of this.repos) {
      repoStatuses[name] = repo.status;
    }
    return {
      phase: this.phase,
      progress: this.phase === "completed" ? 100 : 0,
      currentTier: this.currentTier,
      repoStatuses,
    };
  }
}