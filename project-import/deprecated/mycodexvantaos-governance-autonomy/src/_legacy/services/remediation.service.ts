import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — governance-autonomy / RemediationService
 * Auto-remediation for compliance violations
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type RemediationStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export interface RemediationAction { id: string; violation: string; action: string; status: RemediationStatus; automated: boolean; result?: string; startedAt: number; completedAt?: number; }

export class RemediationService {
  private get providers() { return getProviders(); }
  private handlers = new Map<string, (violation: string) => Promise<string>>();

  registerHandler(violationType: string, handler: (violation: string) => Promise<string>): void {
    this.handlers.set(violationType, handler);
  }

  async remediate(violation: string, options?: { automated?: boolean; dryRun?: boolean }): Promise<RemediationAction> {
    const id = `remediation-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const action: RemediationAction = { id, violation, action: 'auto', status: 'pending', automated: options?.automated ?? true, startedAt: Date.now() };
    const handler = this.handlers.get(violation);
    if (!handler) { action.status = 'skipped'; action.result = 'No handler registered'; }
    else if (options?.dryRun) { action.status = 'skipped'; action.result = 'Dry run - no action taken'; }
    else {
      try {
        action.status = 'running';
        action.result = await handler(violation);
        action.status = 'completed';
      } catch (err) { action.status = 'failed'; action.result = String(err); }
    }
    action.completedAt = Date.now();
    await this.providers.stateStore.set(`governance:remediation:${id}`, action);
    this.providers.observability.info('Remediation action', { id, violation, status: action.status });
    return action;
  }

  async listActions(status?: RemediationStatus): Promise<RemediationAction[]> {
    const result = await this.providers.stateStore.scan<RemediationAction>({ pattern: 'governance:remediation:*', count: 100 });
    let actions = result.entries.map(e => e.value).filter(a => a.violation);
    if (status) actions = actions.filter(a => a.status === status);
    return actions.sort((a, b) => b.startedAt - a.startedAt);
  }

  async getAction(actionId: string): Promise<RemediationAction | null> {
    return (await this.providers.stateStore.get<RemediationAction>(`governance:remediation:${actionId}`))?.value ?? null;
  }
}
