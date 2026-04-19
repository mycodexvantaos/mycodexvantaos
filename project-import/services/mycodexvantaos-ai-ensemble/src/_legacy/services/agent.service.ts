import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — ai-engine / AgentService
 * AI Agent execution and lifecycle
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type AgentStatus = 'idle' | 'thinking' | 'executing' | 'waiting' | 'completed' | 'error';
export interface Agent { id: string; name: string; systemPrompt: string; tools: string[]; status: AgentStatus; conversationHistory: Array<{ role: string; content: string }>; createdAt: number; lastActiveAt: number; }

export class AgentService {
  private agents = new Map<string, Agent>();
  private get providers() { return getProviders(); }

  async create(name: string, systemPrompt: string, tools: string[] = []): Promise<Agent> {
    const id = `agent-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const agent: Agent = { id, name, systemPrompt, tools, status: 'idle', conversationHistory: [{ role: 'system', content: systemPrompt }], createdAt: Date.now(), lastActiveAt: Date.now() };
    this.agents.set(id, agent);
    await this.providers.stateStore.set(`ai:agent:${id}`, agent);
    this.providers.observability.info('Agent created', { agentId: id, name });
    return agent;
  }

  async execute(agentId: string, input: string): Promise<{ response: string; toolCalls: string[] }> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent not found: ${agentId}`);
    agent.status = 'thinking';
    agent.conversationHistory.push({ role: 'user', content: input });
    agent.lastActiveAt = Date.now();
    await this.providers.stateStore.set(`ai:agent:${agentId}`, agent);

    // Queue the execution
    await this.providers.queue.enqueue('ai:agent:execute', { agentId, input, timestamp: Date.now() });

    // Native mode: simple pattern-based response
    const response = `[Agent ${agent.name}] Processed input: "${input.slice(0, 80)}"`;
    const toolCalls: string[] = [];

    agent.conversationHistory.push({ role: 'assistant', content: response });
    agent.status = 'idle';
    await this.providers.stateStore.set(`ai:agent:${agentId}`, agent);
    return { response, toolCalls };
  }

  async getAgent(agentId: string): Promise<Agent | null> {
    return this.agents.get(agentId) ?? (await this.providers.stateStore.get<Agent>(`ai:agent:${agentId}`))?.value ?? null;
  }

  async listAgents(): Promise<Agent[]> {
    const result = await this.providers.stateStore.scan<Agent>({ pattern: 'ai:agent:*', count: 50 });
    return result.entries.map(e => e.value);
  }

  async destroy(agentId: string): Promise<boolean> {
    this.agents.delete(agentId);
    return this.providers.stateStore.delete(`ai:agent:${agentId}`);
  }
}
