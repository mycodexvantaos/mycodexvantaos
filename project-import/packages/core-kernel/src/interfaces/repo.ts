/**
 * CodexvantaOS — RepoProvider
 * 
 * Abstract interface for source code repository operations.
 * Native mode: local Git operations via CLI (zero API dependencies)
 * External mode: GitHub API, GitLab API, Bitbucket API, Gitea, etc.
 * 
 * Covers: repo CRUD, branch management, commit inspection,
 *         PR/MR workflows, webhook management, file operations.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RepoInfo {
  name: string;
  fullName: string;          // e.g. "org/repo-name"
  description?: string;
  defaultBranch: string;
  visibility: 'public' | 'private' | 'internal';
  cloneUrl: string;
  sshUrl?: string;
  createdAt: number;
  updatedAt: number;
  size?: number;             // KB
  language?: string;
  topics?: string[];
}

export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
  aheadBehind?: { ahead: number; behind: number };
}

export interface CommitInfo {
  sha: string;
  message: string;
  author: { name: string; email: string; date: number };
  committer: { name: string; email: string; date: number };
  parents: string[];
  filesChanged?: number;
  additions?: number;
  deletions?: number;
}

export interface FileContent {
  path: string;
  content: string;           // UTF-8 decoded
  encoding: 'utf-8' | 'base64';
  sha: string;
  size: number;
}

export type PullRequestState = 'open' | 'closed' | 'merged';

export interface PullRequest {
  id: number | string;
  number: number;
  title: string;
  body?: string;
  state: PullRequestState;
  sourceBranch: string;
  targetBranch: string;
  author: string;
  createdAt: number;
  updatedAt: number;
  mergedAt?: number;
  mergeable?: boolean;
  labels?: string[];
  reviewers?: string[];
}

export interface CreatePullRequestInput {
  title: string;
  body?: string;
  sourceBranch: string;
  targetBranch: string;
  labels?: string[];
  reviewers?: string[];
  draft?: boolean;
}

export interface WebhookConfig {
  id?: string;
  url: string;
  events: string[];          // e.g. ['push', 'pull_request']
  active: boolean;
  secret?: string;
}

export interface TagInfo {
  name: string;
  sha: string;
  message?: string;
  tagger?: { name: string; email: string; date: number };
}

export interface RepoListOptions {
  page?: number;
  perPage?: number;
  sort?: 'name' | 'updated' | 'created';
  direction?: 'asc' | 'desc';
  visibility?: 'public' | 'private' | 'all';
}

export interface RepoHealth {
  healthy: boolean;
  mode: 'native' | 'external';
  provider: string;
  repoCount?: number;
  rateLimitRemaining?: number;   // for API-based providers
  rateLimitReset?: number;       // epoch sec
  details?: Record<string, unknown>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface RepoProvider {
  readonly providerId: string;
  readonly mode: 'native' | 'external';

  /** Initialise provider (auth, clone cache, etc.) */
  init(): Promise<void>;

  // ── Repository CRUD ─────────────────────────────────────────────────────

  getRepo(repoName: string): Promise<RepoInfo | null>;
  listRepos(options?: RepoListOptions): Promise<RepoInfo[]>;
  createRepo?(name: string, options?: { description?: string; visibility?: 'public' | 'private'; autoInit?: boolean }): Promise<RepoInfo>;
  deleteRepo?(repoName: string): Promise<void>;

  // ── Branch Management ───────────────────────────────────────────────────

  listBranches(repoName: string): Promise<BranchInfo[]>;
  getBranch(repoName: string, branch: string): Promise<BranchInfo | null>;
  createBranch(repoName: string, branch: string, fromRef: string): Promise<BranchInfo>;
  deleteBranch(repoName: string, branch: string): Promise<void>;

  // ── Commit Inspection ───────────────────────────────────────────────────

  getCommit(repoName: string, sha: string): Promise<CommitInfo | null>;
  listCommits(repoName: string, options?: { branch?: string; since?: number; until?: number; limit?: number }): Promise<CommitInfo[]>;

  // ── File Operations ─────────────────────────────────────────────────────

  getFile(repoName: string, path: string, ref?: string): Promise<FileContent | null>;
  putFile(repoName: string, path: string, content: string, message: string, options?: { branch?: string; sha?: string }): Promise<CommitInfo>;
  deleteFile(repoName: string, path: string, message: string, options?: { branch?: string; sha?: string }): Promise<CommitInfo>;

  // ── Pull Requests / Merge Requests ──────────────────────────────────────

  listPullRequests(repoName: string, options?: { state?: PullRequestState; limit?: number }): Promise<PullRequest[]>;
  getPullRequest(repoName: string, prNumber: number): Promise<PullRequest | null>;
  createPullRequest(repoName: string, input: CreatePullRequestInput): Promise<PullRequest>;
  mergePullRequest(repoName: string, prNumber: number, options?: { method?: 'merge' | 'squash' | 'rebase'; message?: string }): Promise<CommitInfo>;
  closePullRequest?(repoName: string, prNumber: number): Promise<void>;

  // ── Tags ────────────────────────────────────────────────────────────────

  listTags(repoName: string): Promise<TagInfo[]>;
  createTag?(repoName: string, tag: string, sha: string, message?: string): Promise<TagInfo>;

  // ── Webhooks (optional) ─────────────────────────────────────────────────

  listWebhooks?(repoName: string): Promise<WebhookConfig[]>;
  createWebhook?(repoName: string, config: WebhookConfig): Promise<WebhookConfig>;
  deleteWebhook?(repoName: string, webhookId: string): Promise<void>;

  // ── Clone / Checkout (native-friendly) ──────────────────────────────────

  /** Clone or update a local copy. Returns the local path. */
  ensureLocal?(repoName: string, options?: { branch?: string; depth?: number }): Promise<string>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  healthcheck(): Promise<RepoHealth>;
  close(): Promise<void>;
}