/**
 * NativeRepoProvider — Local Git CLI implementation
 * 
 * Zero API dependencies. All operations via local git commands.
 *  - Clone / fetch / pull via git CLI
 *  - Branch, commit, tag operations via git plumbing
 *  - File operations via direct filesystem access
 *  - PR simulation via local branch conventions
 *  - No GitHub API, no GitLab API, no Bitbucket API required
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
  RepoListOptions,
  RepoHealth,
} from '../../interfaces/repo';

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

interface NativeRepoConfig {
  /** Root directory containing all repositories. */
  reposDir?: string;
  /** Default remote name. */
  defaultRemote?: string;
}

export class NativeRepoProvider implements RepoProvider {
  readonly providerId = 'native-git-cli';
  readonly mode = 'native' as const;

  private config: Required<NativeRepoConfig>;

  constructor(config?: NativeRepoConfig) {
    this.config = {
      reposDir: config?.reposDir ?? path.join(process.cwd(), '.codexvanta', 'repos'),
      defaultRemote: config?.defaultRemote ?? 'origin',
    };
  }

  async init(): Promise<void> {
    if (!fs.existsSync(this.config.reposDir)) {
      fs.mkdirSync(this.config.reposDir, { recursive: true });
    }
    // Verify git is available
    try {
      this.git(['--version']);
    } catch {
      throw new Error('Git CLI not found. NativeRepoProvider requires git to be installed.');
    }
  }

  // ── Repository CRUD ─────────────────────────────────────────────────────────

  async getRepo(repoName: string): Promise<RepoInfo | null> {
    const repoPath = this.repoPath(repoName);
    if (!fs.existsSync(repoPath) || !fs.existsSync(path.join(repoPath, '.git'))) {
      return null;
    }
    return this.buildRepoInfo(repoName, repoPath);
  }

  async listRepos(options?: RepoListOptions): Promise<RepoInfo[]> {
    if (!fs.existsSync(this.config.reposDir)) return [];

    const dirs = fs.readdirSync(this.config.reposDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .filter(d => fs.existsSync(path.join(this.config.reposDir, d.name, '.git')))
      .map(d => d.name);

    const repos: RepoInfo[] = [];
    for (const dir of dirs) {
      const info = await this.getRepo(dir);
      if (info) repos.push(info);
    }

    const sort = options?.sort ?? 'name';
    const dir = options?.direction ?? 'asc';
    repos.sort((a, b) => {
      let cmp = 0;
      if (sort === 'name') cmp = a.name.localeCompare(b.name);
      else if (sort === 'updated') cmp = a.updatedAt - b.updatedAt;
      else if (sort === 'created') cmp = a.createdAt - b.createdAt;
      return dir === 'desc' ? -cmp : cmp;
    });

    const page = options?.page ?? 1;
    const perPage = options?.perPage ?? 30;
    return repos.slice((page - 1) * perPage, page * perPage);
  }

  async createRepo(
    name: string,
    options?: { description?: string; visibility?: 'public' | 'private'; autoInit?: boolean }
  ): Promise<RepoInfo> {
    const repoPath = this.repoPath(name);
    if (fs.existsSync(repoPath)) {
      throw new Error(`Repository already exists: ${name}`);
    }

    fs.mkdirSync(repoPath, { recursive: true });
    this.gitIn(repoPath, ['init']);

    if (options?.autoInit !== false) {
      const readmeContent = `# ${name}\n\n${options?.description ?? ''}\n`;
      fs.writeFileSync(path.join(repoPath, 'README.md'), readmeContent);
      this.gitIn(repoPath, ['add', '.']);
      this.gitIn(repoPath, ['commit', '-m', 'Initial commit']);
    }

    return this.buildRepoInfo(name, repoPath);
  }

  async deleteRepo(repoName: string): Promise<void> {
    const repoPath = this.repoPath(repoName);
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  }

  // ── Branch Management ───────────────────────────────────────────────────────

  async listBranches(repoName: string): Promise<BranchInfo[]> {
    const repoPath = this.repoPath(repoName);
    const output = this.gitIn(repoPath, ['branch', '--format=%(refname:short) %(objectname:short)', '-a']);

    return output.trim().split('\n').filter(Boolean).map(line => {
      const [name, sha] = line.trim().split(' ');
      return { name, sha, protected: name === 'main' || name === 'master' };
    });
  }

  async getBranch(repoName: string, branch: string): Promise<BranchInfo | null> {
    const branches = await this.listBranches(repoName);
    return branches.find(b => b.name === branch) ?? null;
  }

  async createBranch(repoName: string, branch: string, fromRef: string): Promise<BranchInfo> {
    const repoPath = this.repoPath(repoName);
    this.gitIn(repoPath, ['branch', branch, fromRef]);
    const sha = this.gitIn(repoPath, ['rev-parse', branch]).trim();
    return { name: branch, sha, protected: false };
  }

  async deleteBranch(repoName: string, branch: string): Promise<void> {
    const repoPath = this.repoPath(repoName);
    this.gitIn(repoPath, ['branch', '-D', branch]);
  }

  // ── Commit Inspection ───────────────────────────────────────────────────────

  async getCommit(repoName: string, sha: string): Promise<CommitInfo | null> {
    const repoPath = this.repoPath(repoName);
    try {
      const format = '%H%n%s%n%an%n%ae%n%at%n%cn%n%ce%n%ct%n%P';
      const output = this.gitIn(repoPath, ['log', '-1', `--format=${format}`, sha]);
      const lines = output.trim().split('\n');
      if (lines.length < 8) return null;

      return {
        sha: lines[0],
        message: lines[1],
        author: { name: lines[2], email: lines[3], date: parseInt(lines[4]) * 1000 },
        committer: { name: lines[5], email: lines[6], date: parseInt(lines[7]) * 1000 },
        parents: lines[8] ? lines[8].split(' ') : [],
      };
    } catch {
      return null;
    }
  }

  async listCommits(
    repoName: string,
    options?: { branch?: string; since?: number; until?: number; limit?: number }
  ): Promise<CommitInfo[]> {
    const repoPath = this.repoPath(repoName);
    const args = ['log', `--format=%H|%s|%an|%ae|%at|%cn|%ce|%ct|%P`];

    if (options?.branch) args.push(options.branch);
    if (options?.limit) args.push(`-${options.limit}`);
    if (options?.since) args.push(`--since=${Math.floor(options.since / 1000)}`);
    if (options?.until) args.push(`--until=${Math.floor(options.until / 1000)}`);

    try {
      const output = this.gitIn(repoPath, args);
      return output.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split('|');
        return {
          sha: parts[0],
          message: parts[1],
          author: { name: parts[2], email: parts[3], date: parseInt(parts[4]) * 1000 },
          committer: { name: parts[5], email: parts[6], date: parseInt(parts[7]) * 1000 },
          parents: parts[8] ? parts[8].split(' ') : [],
        };
      });
    } catch {
      return [];
    }
  }

  // ── File Operations ─────────────────────────────────────────────────────────

  async getFile(repoName: string, filePath: string, ref?: string): Promise<FileContent | null> {
    const repoPath = this.repoPath(repoName);
    try {
      const treeRef = ref ?? 'HEAD';
      const content = this.gitIn(repoPath, ['show', `${treeRef}:${filePath}`]);
      const sha = this.gitIn(repoPath, ['hash-object', '--stdin'], content).trim();

      return {
        path: filePath,
        content,
        encoding: 'utf-8',
        sha,
        size: Buffer.byteLength(content, 'utf-8'),
      };
    } catch {
      return null;
    }
  }

  async putFile(
    repoName: string,
    filePath: string,
    content: string,
    message: string,
    options?: { branch?: string; sha?: string }
  ): Promise<CommitInfo> {
    const repoPath = this.repoPath(repoName);

    if (options?.branch) {
      this.gitIn(repoPath, ['checkout', options.branch]);
    }

    const fullPath = path.join(repoPath, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    fs.writeFileSync(fullPath, content);
    this.gitIn(repoPath, ['add', filePath]);
    this.gitIn(repoPath, ['commit', '-m', message]);

    const sha = this.gitIn(repoPath, ['rev-parse', 'HEAD']).trim();
    return (await this.getCommit(repoName, sha))!;
  }

  async deleteFile(
    repoName: string,
    filePath: string,
    message: string,
    options?: { branch?: string; sha?: string }
  ): Promise<CommitInfo> {
    const repoPath = this.repoPath(repoName);

    if (options?.branch) {
      this.gitIn(repoPath, ['checkout', options.branch]);
    }

    this.gitIn(repoPath, ['rm', filePath]);
    this.gitIn(repoPath, ['commit', '-m', message]);

    const sha = this.gitIn(repoPath, ['rev-parse', 'HEAD']).trim();
    return (await this.getCommit(repoName, sha))!;
  }

  // ── Pull Requests (local simulation via branch conventions) ─────────────────

  async listPullRequests(
    repoName: string,
    options?: { state?: PullRequestState; limit?: number }
  ): Promise<PullRequest[]> {
    const repoPath = this.repoPath(repoName);
    const prFile = path.join(repoPath, '.git', 'local-prs.json');
    const prs: PullRequest[] = this.loadJson(prFile) ?? [];

    let filtered = prs;
    if (options?.state) filtered = filtered.filter(p => p.state === options.state);
    if (options?.limit) filtered = filtered.slice(0, options.limit);
    return filtered;
  }

  async getPullRequest(repoName: string, prNumber: number): Promise<PullRequest | null> {
    const prs = await this.listPullRequests(repoName);
    return prs.find(p => p.number === prNumber) ?? null;
  }

  async createPullRequest(repoName: string, input: CreatePullRequestInput): Promise<PullRequest> {
    const repoPath = this.repoPath(repoName);
    const prFile = path.join(repoPath, '.git', 'local-prs.json');
    const prs: PullRequest[] = this.loadJson(prFile) ?? [];

    const pr: PullRequest = {
      id: prs.length + 1,
      number: prs.length + 1,
      title: input.title,
      body: input.body,
      state: 'open',
      sourceBranch: input.sourceBranch,
      targetBranch: input.targetBranch,
      author: 'local',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      labels: input.labels,
      reviewers: input.reviewers,
    };

    prs.push(pr);
    fs.writeFileSync(prFile, JSON.stringify(prs, null, 2));
    return pr;
  }

  async mergePullRequest(
    repoName: string,
    prNumber: number,
    options?: { method?: 'merge' | 'squash' | 'rebase'; message?: string }
  ): Promise<CommitInfo> {
    const repoPath = this.repoPath(repoName);
    const pr = await this.getPullRequest(repoName, prNumber);
    if (!pr || pr.state !== 'open') throw new Error(`PR #${prNumber} not found or not open`);

    this.gitIn(repoPath, ['checkout', pr.targetBranch]);

    const method = options?.method ?? 'merge';
    if (method === 'squash') {
      this.gitIn(repoPath, ['merge', '--squash', pr.sourceBranch]);
      this.gitIn(repoPath, ['commit', '-m', options?.message ?? `Merge PR #${prNumber}: ${pr.title}`]);
    } else if (method === 'rebase') {
      this.gitIn(repoPath, ['rebase', pr.sourceBranch]);
    } else {
      this.gitIn(repoPath, ['merge', pr.sourceBranch, '-m', options?.message ?? `Merge PR #${prNumber}`]);
    }

    // Update PR state
    const prFile = path.join(repoPath, '.git', 'local-prs.json');
    const prs: PullRequest[] = this.loadJson(prFile) ?? [];
    const prIdx = prs.findIndex(p => p.number === prNumber);
    if (prIdx >= 0) {
      prs[prIdx].state = 'merged';
      prs[prIdx].mergedAt = Date.now();
      fs.writeFileSync(prFile, JSON.stringify(prs, null, 2));
    }

    const sha = this.gitIn(repoPath, ['rev-parse', 'HEAD']).trim();
    return (await this.getCommit(repoName, sha))!;
  }

  // ── Tags ────────────────────────────────────────────────────────────────────

  async listTags(repoName: string): Promise<TagInfo[]> {
    const repoPath = this.repoPath(repoName);
    try {
      const output = this.gitIn(repoPath, ['tag', '-l', '--format=%(refname:short) %(objectname:short)']);
      return output.trim().split('\n').filter(Boolean).map(line => {
        const [name, sha] = line.trim().split(' ');
        return { name, sha };
      });
    } catch {
      return [];
    }
  }

  async createTag(repoName: string, tag: string, sha: string, message?: string): Promise<TagInfo> {
    const repoPath = this.repoPath(repoName);
    if (message) {
      this.gitIn(repoPath, ['tag', '-a', tag, sha, '-m', message]);
    } else {
      this.gitIn(repoPath, ['tag', tag, sha]);
    }
    return { name: tag, sha, message };
  }

  // ── Clone / Checkout ────────────────────────────────────────────────────────

  async ensureLocal(
    repoName: string,
    options?: { branch?: string; depth?: number }
  ): Promise<string> {
    const repoPath = this.repoPath(repoName);
    if (fs.existsSync(path.join(repoPath, '.git'))) {
      // Already exists, fetch latest
      try {
        this.gitIn(repoPath, ['fetch', '--all']);
        if (options?.branch) {
          this.gitIn(repoPath, ['checkout', options.branch]);
          this.gitIn(repoPath, ['pull', '--ff-only']);
        }
      } catch {
        // Best-effort update
      }
    }
    return repoPath;
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  async healthcheck(): Promise<RepoHealth> {
    try {
      const version = this.git(['--version']).trim();
      const repos = fs.existsSync(this.config.reposDir)
        ? fs.readdirSync(this.config.reposDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .filter(d => fs.existsSync(path.join(this.config.reposDir, d.name, '.git')))
            .length
        : 0;

      return {
        healthy: true,
        mode: 'native',
        provider: this.providerId,
        repoCount: repos,
        details: { gitVersion: version, reposDir: this.config.reposDir },
      };
    } catch (err) {
      return {
        healthy: false,
        mode: 'native',
        provider: this.providerId,
        details: { error: String(err) },
      };
    }
  }

  async close(): Promise<void> {
    // No connections to close
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private repoPath(repoName: string): string {
    return path.join(this.config.reposDir, repoName);
  }

  private git(args: string[]): string {
    return execSync(`git ${args.join(' ')}`, { encoding: 'utf-8', timeout: 30000 });
  }

  private gitIn(cwd: string, args: string[], input?: string): string {
    return execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      timeout: 30000,
      input,
    });
  }

  private buildRepoInfo(name: string, repoPath: string): RepoInfo {
    let defaultBranch = 'main';
    try {
      defaultBranch = this.gitIn(repoPath, ['symbolic-ref', '--short', 'HEAD']).trim();
    } catch { /* fallback to main */ }

    let cloneUrl = '';
    try {
      cloneUrl = this.gitIn(repoPath, ['remote', 'get-url', this.config.defaultRemote]).trim();
    } catch { /* no remote */ }

    const stat = fs.statSync(repoPath);

    return {
      name,
      fullName: name,
      defaultBranch,
      visibility: 'private',
      cloneUrl: cloneUrl || repoPath,
      createdAt: stat.birthtimeMs,
      updatedAt: stat.mtimeMs,
    };
  }

  private loadJson(filePath: string): any | null {
    try {
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch { return null; }
  }
}