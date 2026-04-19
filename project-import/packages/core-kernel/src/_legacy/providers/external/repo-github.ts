/**
 * GitHubRepoProvider — External GitHub API-based repository operations
 * 
 * Example external provider showing how GitHub API plugs into
 * the RepoProvider interface as an OPTIONAL connector.
 * 
 * The platform works without this via NativeRepoProvider (local Git CLI).
 * 
 * Install dependencies:
 *   npm install @octokit/rest
 */

import type {
  RepoProvider,
  RepoInfo,
  BranchInfo,
  CommitInfo,
  FileContent,
  PullRequest,
  PullRequestState,
  CreatePullRequestInput,
  TagInfo,
  WebhookConfig,
  RepoListOptions,
  RepoHealth,
} from '../../interfaces/repo';

interface GitHubRepoConfig {
  token: string;
  owner: string;
  baseUrl?: string;     // for GitHub Enterprise
}

export class GitHubRepoProvider implements RepoProvider {
  readonly providerId = 'external-github-api';
  readonly mode = 'external' as const;

  private octokit: any = null;
  private config: GitHubRepoConfig;

  constructor(config: GitHubRepoConfig) {
    this.config = config;
  }

  async init(): Promise<void> {
    const { Octokit } = await import('@octokit/rest');
    this.octokit = new Octokit({
      auth: this.config.token,
      baseUrl: this.config.baseUrl,
    });
    // Verify authentication
    await this.octokit.rest.users.getAuthenticated();
  }

  async getRepo(repoName: string): Promise<RepoInfo | null> {
    try {
      const { data } = await this.octokit.rest.repos.get({
        owner: this.config.owner,
        repo: repoName,
      });
      return this.mapRepo(data);
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async listRepos(options?: RepoListOptions): Promise<RepoInfo[]> {
    const { data } = await this.octokit.rest.repos.listForOrg({
      org: this.config.owner,
      per_page: options?.perPage ?? 30,
      page: options?.page ?? 1,
      sort: options?.sort === 'name' ? 'full_name' : options?.sort ?? 'updated',
      direction: options?.direction ?? 'desc',
      type: options?.visibility === 'public' ? 'public' : options?.visibility === 'private' ? 'private' : 'all',
    });
    return data.map((r: any) => this.mapRepo(r));
  }

  async createRepo(
    name: string,
    options?: { description?: string; visibility?: 'public' | 'private'; autoInit?: boolean }
  ): Promise<RepoInfo> {
    const { data } = await this.octokit.rest.repos.createInOrg({
      org: this.config.owner,
      name,
      description: options?.description,
      private: options?.visibility === 'private',
      auto_init: options?.autoInit ?? true,
    });
    return this.mapRepo(data);
  }

  async deleteRepo(repoName: string): Promise<void> {
    await this.octokit.rest.repos.delete({ owner: this.config.owner, repo: repoName });
  }

  // ── Branch Management ───────────────────────────────────────────────────────

  async listBranches(repoName: string): Promise<BranchInfo[]> {
    const { data } = await this.octokit.rest.repos.listBranches({
      owner: this.config.owner, repo: repoName, per_page: 100,
    });
    return data.map((b: any) => ({
      name: b.name,
      sha: b.commit.sha,
      protected: b.protected,
    }));
  }

  async getBranch(repoName: string, branch: string): Promise<BranchInfo | null> {
    try {
      const { data } = await this.octokit.rest.repos.getBranch({
        owner: this.config.owner, repo: repoName, branch,
      });
      return { name: data.name, sha: data.commit.sha, protected: data.protected };
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async createBranch(repoName: string, branch: string, fromRef: string): Promise<BranchInfo> {
    const { data: refData } = await this.octokit.rest.git.getRef({
      owner: this.config.owner, repo: repoName,
      ref: fromRef.startsWith('heads/') ? fromRef : `heads/${fromRef}`,
    }).catch(() => this.octokit.rest.git.getCommit({
      owner: this.config.owner, repo: repoName, commit_sha: fromRef,
    }).then((r: any) => ({ data: { object: { sha: r.data.sha } } })));

    const sha = refData.object?.sha ?? refData.sha;
    await this.octokit.rest.git.createRef({
      owner: this.config.owner, repo: repoName,
      ref: `refs/heads/${branch}`, sha,
    });

    return { name: branch, sha, protected: false };
  }

  async deleteBranch(repoName: string, branch: string): Promise<void> {
    await this.octokit.rest.git.deleteRef({
      owner: this.config.owner, repo: repoName, ref: `heads/${branch}`,
    });
  }

  // ── Commits ─────────────────────────────────────────────────────────────────

  async getCommit(repoName: string, sha: string): Promise<CommitInfo | null> {
    try {
      const { data } = await this.octokit.rest.repos.getCommit({
        owner: this.config.owner, repo: repoName, ref: sha,
      });
      return this.mapCommit(data);
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async listCommits(repoName: string, options?: {
    branch?: string; since?: number; until?: number; limit?: number;
  }): Promise<CommitInfo[]> {
    const { data } = await this.octokit.rest.repos.listCommits({
      owner: this.config.owner, repo: repoName,
      sha: options?.branch,
      since: options?.since ? new Date(options.since).toISOString() : undefined,
      until: options?.until ? new Date(options.until).toISOString() : undefined,
      per_page: options?.limit ?? 30,
    });
    return data.map((c: any) => this.mapCommit(c));
  }

  // ── File Operations ─────────────────────────────────────────────────────────

  async getFile(repoName: string, filePath: string, ref?: string): Promise<FileContent | null> {
    try {
      const { data } = await this.octokit.rest.repos.getContent({
        owner: this.config.owner, repo: repoName, path: filePath, ref,
      });
      if (Array.isArray(data)) return null; // directory
      return {
        path: data.path,
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
        encoding: 'utf-8',
        sha: data.sha,
        size: data.size,
      };
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async putFile(repoName: string, filePath: string, content: string, message: string, options?: {
    branch?: string; sha?: string;
  }): Promise<CommitInfo> {
    const params: any = {
      owner: this.config.owner, repo: repoName, path: filePath,
      message,
      content: Buffer.from(content).toString('base64'),
      branch: options?.branch,
    };
    if (options?.sha) params.sha = options.sha;

    const { data } = await this.octokit.rest.repos.createOrUpdateFileContents(params);
    return {
      sha: data.commit.sha,
      message: data.commit.message,
      author: { name: data.commit.author.name, email: data.commit.author.email, date: new Date(data.commit.author.date).getTime() },
      committer: { name: data.commit.committer.name, email: data.commit.committer.email, date: new Date(data.commit.committer.date).getTime() },
      parents: data.commit.parents?.map((p: any) => p.sha) ?? [],
    };
  }

  async deleteFile(repoName: string, filePath: string, message: string, options?: {
    branch?: string; sha?: string;
  }): Promise<CommitInfo> {
    const existing = await this.getFile(repoName, filePath, options?.branch);
    if (!existing) throw new Error(`File not found: ${filePath}`);

    const { data } = await this.octokit.rest.repos.deleteFile({
      owner: this.config.owner, repo: repoName, path: filePath,
      message, sha: options?.sha ?? existing.sha, branch: options?.branch,
    });
    return {
      sha: data.commit.sha, message: data.commit.message,
      author: { name: data.commit.author.name, email: data.commit.author.email, date: new Date(data.commit.author.date).getTime() },
      committer: { name: data.commit.committer.name, email: data.commit.committer.email, date: new Date(data.commit.committer.date).getTime() },
      parents: [],
    };
  }

  // ── Pull Requests ───────────────────────────────────────────────────────────

  async listPullRequests(repoName: string, options?: {
    state?: PullRequestState; limit?: number;
  }): Promise<PullRequest[]> {
    const ghState = options?.state === 'merged' ? 'closed' : options?.state ?? 'open';
    const { data } = await this.octokit.rest.pulls.list({
      owner: this.config.owner, repo: repoName,
      state: ghState, per_page: options?.limit ?? 30,
    });

    let results = data.map((pr: any) => this.mapPullRequest(pr));
    if (options?.state === 'merged') results = results.filter((pr: PullRequest) => pr.state === 'merged');
    return results;
  }

  async getPullRequest(repoName: string, prNumber: number): Promise<PullRequest | null> {
    try {
      const { data } = await this.octokit.rest.pulls.get({
        owner: this.config.owner, repo: repoName, pull_number: prNumber,
      });
      return this.mapPullRequest(data);
    } catch (e: any) {
      if (e.status === 404) return null;
      throw e;
    }
  }

  async createPullRequest(repoName: string, input: CreatePullRequestInput): Promise<PullRequest> {
    const { data } = await this.octokit.rest.pulls.create({
      owner: this.config.owner, repo: repoName,
      title: input.title, body: input.body,
      head: input.sourceBranch, base: input.targetBranch,
      draft: input.draft,
    });

    if (input.labels?.length) {
      await this.octokit.rest.issues.addLabels({
        owner: this.config.owner, repo: repoName,
        issue_number: data.number, labels: input.labels,
      });
    }
    if (input.reviewers?.length) {
      await this.octokit.rest.pulls.requestReviewers({
        owner: this.config.owner, repo: repoName,
        pull_number: data.number, reviewers: input.reviewers,
      });
    }

    return this.mapPullRequest(data);
  }

  async mergePullRequest(repoName: string, prNumber: number, options?: {
    method?: 'merge' | 'squash' | 'rebase'; message?: string;
  }): Promise<CommitInfo> {
    const { data } = await this.octokit.rest.pulls.merge({
      owner: this.config.owner, repo: repoName,
      pull_number: prNumber,
      merge_method: options?.method ?? 'merge',
      commit_message: options?.message,
    });
    return (await this.getCommit(repoName, data.sha))!;
  }

  async closePullRequest(repoName: string, prNumber: number): Promise<void> {
    await this.octokit.rest.pulls.update({
      owner: this.config.owner, repo: repoName,
      pull_number: prNumber, state: 'closed',
    });
  }

  // ── Tags ────────────────────────────────────────────────────────────────────

  async listTags(repoName: string): Promise<TagInfo[]> {
    const { data } = await this.octokit.rest.repos.listTags({
      owner: this.config.owner, repo: repoName, per_page: 100,
    });
    return data.map((t: any) => ({ name: t.name, sha: t.commit.sha }));
  }

  async createTag(repoName: string, tag: string, sha: string, message?: string): Promise<TagInfo> {
    if (message) {
      const { data: tagObj } = await this.octokit.rest.git.createTag({
        owner: this.config.owner, repo: repoName,
        tag, message, object: sha, type: 'commit',
      });
      await this.octokit.rest.git.createRef({
        owner: this.config.owner, repo: repoName,
        ref: `refs/tags/${tag}`, sha: tagObj.sha,
      });
      return { name: tag, sha: tagObj.sha, message };
    }
    await this.octokit.rest.git.createRef({
      owner: this.config.owner, repo: repoName,
      ref: `refs/tags/${tag}`, sha,
    });
    return { name: tag, sha };
  }

  // ── Webhooks ────────────────────────────────────────────────────────────────

  async listWebhooks(repoName: string): Promise<WebhookConfig[]> {
    const { data } = await this.octokit.rest.repos.listWebhooks({
      owner: this.config.owner, repo: repoName,
    });
    return data.map((w: any) => ({
      id: String(w.id), url: w.config.url,
      events: w.events, active: w.active,
    }));
  }

  async createWebhook(repoName: string, config: WebhookConfig): Promise<WebhookConfig> {
    const { data } = await this.octokit.rest.repos.createWebhook({
      owner: this.config.owner, repo: repoName,
      config: { url: config.url, content_type: 'json', secret: config.secret },
      events: config.events, active: config.active,
    });
    return { id: String(data.id), url: config.url, events: data.events, active: data.active };
  }

  async deleteWebhook(repoName: string, webhookId: string): Promise<void> {
    await this.octokit.rest.repos.deleteWebhook({
      owner: this.config.owner, repo: repoName, hook_id: parseInt(webhookId),
    });
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async healthcheck(): Promise<RepoHealth> {
    const start = Date.now();
    try {
      const { data } = await this.octokit.rest.rateLimit.get();
      return {
        healthy: true, mode: 'external', provider: this.providerId,
        rateLimitRemaining: data.resources.core.remaining,
        rateLimitReset: data.resources.core.reset,
        details: { owner: this.config.owner, latencyMs: Date.now() - start },
      };
    } catch (err) {
      return {
        healthy: false, mode: 'external', provider: this.providerId,
        details: { error: String(err) },
      };
    }
  }

  async close(): Promise<void> {
    this.octokit = null;
  }

  // ── Private Mappers ─────────────────────────────────────────────────────────

  private mapRepo(data: any): RepoInfo {
    return {
      name: data.name, fullName: data.full_name,
      description: data.description, defaultBranch: data.default_branch,
      visibility: data.private ? 'private' : 'public',
      cloneUrl: data.clone_url, sshUrl: data.ssh_url,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      size: data.size, language: data.language, topics: data.topics,
    };
  }

  private mapCommit(data: any): CommitInfo {
    return {
      sha: data.sha, message: data.commit.message,
      author: { name: data.commit.author.name, email: data.commit.author.email, date: new Date(data.commit.author.date).getTime() },
      committer: { name: data.commit.committer.name, email: data.commit.committer.email, date: new Date(data.commit.committer.date).getTime() },
      parents: data.parents?.map((p: any) => p.sha) ?? [],
      filesChanged: data.stats?.total, additions: data.stats?.additions, deletions: data.stats?.deletions,
    };
  }

  private mapPullRequest(data: any): PullRequest {
    return {
      id: data.id, number: data.number, title: data.title, body: data.body,
      state: data.merged_at ? 'merged' : data.state as PullRequestState,
      sourceBranch: data.head.ref, targetBranch: data.base.ref,
      author: data.user.login,
      createdAt: new Date(data.created_at).getTime(),
      updatedAt: new Date(data.updated_at).getTime(),
      mergedAt: data.merged_at ? new Date(data.merged_at).getTime() : undefined,
      mergeable: data.mergeable,
      labels: data.labels?.map((l: any) => l.name),
      reviewers: data.requested_reviewers?.map((r: any) => r.login),
    };
  }
}