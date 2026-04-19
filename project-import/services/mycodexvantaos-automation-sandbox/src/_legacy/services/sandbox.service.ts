import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — fleet-sandbox / SandboxService
 * Sandbox creation and management
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type SandboxStatus = 'creating' | 'running' | 'paused' | 'stopped' | 'destroyed';
export interface Sandbox { id: string; name: string; owner: string; status: SandboxStatus; image?: string; resources: { cpu: string; memory: string }; ports: number[]; environment: Record<string, string>; createdAt: number; expiresAt?: number; }

export class SandboxService {
  private get providers() { return getProviders(); }

  async create(request: { name: string; owner: string; image?: string; resources?: { cpu?: string; memory?: string }; ports?: number[]; environment?: Record<string, string>; ttlSeconds?: number }): Promise<Sandbox> {
    const id = `sandbox-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const sandbox: Sandbox = {
      id, name: request.name, owner: request.owner, status: 'creating', image: request.image,
      resources: { cpu: request.resources?.cpu ?? '0.5', memory: request.resources?.memory ?? '512Mi' },
      ports: request.ports ?? [], environment: request.environment ?? {},
      createdAt: Date.now(), expiresAt: request.ttlSeconds ? Date.now() + request.ttlSeconds * 1000 : undefined,
    };
    await this.providers.stateStore.set(`sandbox:${id}`, sandbox);
    // Native mode: mark as running (in connected mode would create container)
    sandbox.status = 'running';
    await this.providers.stateStore.set(`sandbox:${id}`, sandbox);
    this.providers.observability.info('Sandbox created', { id, name: request.name });
    return sandbox;
  }

  async get(sandboxId: string): Promise<Sandbox | null> { return (await this.providers.stateStore.get<Sandbox>(`sandbox:${sandboxId}`))?.value ?? null; }

  async stop(sandboxId: string): Promise<Sandbox> {
    const sandbox = await this.get(sandboxId);
    if (!sandbox) throw new Error(`Sandbox not found: ${sandboxId}`);
    sandbox.status = 'stopped';
    await this.providers.stateStore.set(`sandbox:${sandboxId}`, sandbox);
    return sandbox;
  }

  async destroy(sandboxId: string): Promise<void> {
    const sandbox = await this.get(sandboxId);
    if (sandbox) { sandbox.status = 'destroyed'; await this.providers.stateStore.set(`sandbox:${sandboxId}`, sandbox); }
    this.providers.observability.info('Sandbox destroyed', { id: sandboxId });
  }

  async list(owner?: string): Promise<Sandbox[]> {
    const result = await this.providers.stateStore.scan<Sandbox>({ pattern: 'sandbox:*', count: 100 });
    let sandboxes = result.entries.map(e => e.value).filter(s => s.name);
    if (owner) sandboxes = sandboxes.filter(s => s.owner === owner);
    return sandboxes;
  }

  async cleanupExpired(): Promise<number> {
    const now = Date.now();
    const all = await this.list();
    let cleaned = 0;
    for (const sb of all) { if (sb.expiresAt && sb.expiresAt < now && sb.status !== 'destroyed') { await this.destroy(sb.id); cleaned++; } }
    return cleaned;
  }
}
