import type { RepoEntry, SyncResult, GlobalState, RepoState } from "./types";

export class RegistryService {
  private entries = new Map<string, RepoEntry>();
  private states = new Map<string, RepoState>();
  private mode = "normal";
  private phase = "idle";
  private startedAt = new Date();

  add(entry: RepoEntry): void {
    this.entries.set(entry.name, { ...entry });
    this.states.set(entry.name, {
      name: entry.name,
      lastAction: "registered",
      status: entry.status,
      updatedAt: new Date(),
    });
  }

  remove(name: string): boolean {
    this.states.delete(name);
    return this.entries.delete(name);
  }

  get(name: string): RepoEntry | null {
    return this.entries.get(name) ?? null;
  }

  list(): RepoEntry[] {
    return Array.from(this.entries.values());
  }

  sync(incoming: RepoEntry[]): SyncResult {
    const incomingNames = new Set(incoming.map((e) => e.name));
    const currentNames = new Set(this.entries.keys());
    let added = 0;
    let removed = 0;
    const errors: string[] = [];

    for (const entry of incoming) {
      if (!currentNames.has(entry.name)) {
        added++;
      }
      this.add(entry);
    }

    for (const name of currentNames) {
      if (!incomingNames.has(name)) {
        this.remove(name);
        removed++;
      }
    }

    return {
      synced: currentNames.size - removed + added,
      added,
      removed,
      errors,
    };
  }

  setMode(mode: string): void {
    this.mode = mode;
  }

  setPhase(phase: string): void {
    this.phase = phase;
  }

  getGlobalState(): GlobalState {
    const repos: Record<string, RepoState> = {};
    for (const [name, state] of this.states) {
      repos[name] = state;
    }
    return { mode: this.mode, phase: this.phase, repos, startedAt: this.startedAt };
  }
}