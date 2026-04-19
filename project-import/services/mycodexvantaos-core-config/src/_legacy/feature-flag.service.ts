/**
 * CodexvantaOS — config-manager / FeatureFlagService
 * Feature flag management with rollout capabilities
 *
 * Philosophy: Native-first / Provider-agnostic
 */

import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface FeatureFlag {
  name: string; enabled: boolean; description?: string; rolloutPercentage: number;
  targetUsers?: string[]; targetGroups?: string[]; createdAt: number; updatedAt: number;
}

export class FeatureFlagService {
  private get providers() { return getProviders(); }

  async isEnabled(flagName: string, context?: { userId?: string; group?: string }): Promise<boolean> {
    const flag = await this.getFlag(flagName);
    if (!flag || !flag.enabled) return false;
    if (context?.userId &amp;&amp; flag.targetUsers?.includes(context.userId)) return true;
    if (context?.group &amp;&amp; flag.targetGroups?.includes(context.group)) return true;
    if (flag.rolloutPercentage >= 100) return true;
    if (flag.rolloutPercentage <= 0) return false;
    const hash = this.hashString((context?.userId ?? 'anonymous') + flagName);
    return (hash % 100) < flag.rolloutPercentage;
  }

  async upsert(flag: Partial<FeatureFlag> &amp; { name: string }): Promise<FeatureFlag> {
    const existing = await this.getFlag(flag.name);
    const now = Date.now();
    const entry: FeatureFlag = {
      name: flag.name, enabled: flag.enabled ?? existing?.enabled ?? false,
      description: flag.description ?? existing?.description,
      rolloutPercentage: flag.rolloutPercentage ?? existing?.rolloutPercentage ?? 0,
      targetUsers: flag.targetUsers ?? existing?.targetUsers,
      targetGroups: flag.targetGroups ?? existing?.targetGroups,
      createdAt: existing?.createdAt ?? now, updatedAt: now,
    };
    await this.providers.stateStore.set(`featureflag:${flag.name}`, entry);
    this.providers.observability.info('Feature flag updated', { flag: flag.name, enabled: entry.enabled });
    return entry;
  }

  async getFlag(name: string): Promise<FeatureFlag | null> {
    const entry = await this.providers.stateStore.get<FeatureFlag>(`featureflag:${name}`);
    return entry?.value ?? null;
  }

  async listFlags(): Promise<FeatureFlag[]> {
    const result = await this.providers.stateStore.scan<FeatureFlag>({ pattern: 'featureflag:*', count: 200 });
    return result.entries.map(e => e.value);
  }

  async deleteFlag(name: string): Promise<boolean> { return this.providers.stateStore.delete(`featureflag:${name}`); }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); hash = ((hash << 5) - hash) + c; hash |= 0; }
    return Math.abs(hash);
  }
}
