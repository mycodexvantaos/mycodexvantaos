/**
 * CodexvantaOS — infra-base / EnvironmentService
 * Environment configuration and management
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface EnvironmentDef { name: string; displayName: string; type: 'development' | 'staging' | 'production' | 'preview'; variables: Record<string, string>; secrets: string[]; protections: string[]; active: boolean; createdAt: number; }

export class EnvironmentService {
  private get providers() { return getProviders(); }

  async upsert(env: Partial<EnvironmentDef> &amp; { name: string }): Promise<EnvironmentDef> {
    const existing = await this.get(env.name);
    const entry: EnvironmentDef = {
      name: env.name, displayName: env.displayName ?? existing?.displayName ?? env.name,
      type: env.type ?? existing?.type ?? 'development', variables: env.variables ?? existing?.variables ?? {},
      secrets: env.secrets ?? existing?.secrets ?? [], protections: env.protections ?? existing?.protections ?? [],
      active: env.active ?? existing?.active ?? true, createdAt: existing?.createdAt ?? Date.now(),
    };
    await this.providers.stateStore.set(`infra:env:${env.name}`, entry);
    this.providers.observability.info('Environment updated', { name: env.name, type: entry.type });
    return entry;
  }

  async get(name: string): Promise<EnvironmentDef | null> {
    const entry = await this.providers.stateStore.get<EnvironmentDef>(`infra:env:${name}`);
    return entry?.value ?? null;
  }

  async list(): Promise<EnvironmentDef[]> {
    const result = await this.providers.stateStore.scan<EnvironmentDef>({ pattern: 'infra:env:*' });
    return result.entries.map(e => e.value);
  }

  async delete(name: string): Promise<boolean> { return this.providers.stateStore.delete(`infra:env:${name}`); }

  async resolveVariables(name: string): Promise<Record<string, string>> {
    const env = await this.get(name);
    if (!env) throw new Error(`Environment not found: ${name}`);
    const variables = { ...env.variables };
    for (const secretKey of env.secrets) {
      const secretValue = await this.providers.secrets.get(secretKey, 'environment', name);
      if (secretValue) variables[secretKey] = secretValue.value;
    }
    return variables;
  }

  async detectMode(): Promise<'native' | 'connected' | 'hybrid'> {
    const hasRedis = !!process.env['ORCH_STATE_HOST'];
    const hasGithubToken = !!process.env['ORCH_GITHUB_TOKEN'];
    const hasSlack = !!process.env['SLACK_WEBHOOK_URL'];
    const externalCount = [hasRedis, hasGithubToken, hasSlack].filter(Boolean).length;
    if (externalCount === 0) return 'native';
    if (externalCount >= 3) return 'connected';
    return 'hybrid';
  }
}
