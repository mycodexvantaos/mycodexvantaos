import type { Agent, AgentResult, AgentStep, AgentStatus } from "./types";

let counter = 0;

export class AgentService {
  private agents = new Map<string, Agent>();
  private statuses = new Map<string, AgentStatus>();

  create(name: string, model: string, tools: string[], systemPrompt: string): Agent {
    const id = `agent-${++counter}`;
    const agent: Agent = { id, name, model, tools, systemPrompt };
    this.agents.set(id, agent);
    this.statuses.set(id, { agentId: id, state: "idle" });
    return agent;
  }

  remove(agentId: string): boolean {
    this.statuses.delete(agentId);
    return this.agents.delete(agentId);
  }

  getAgent(agentId: string): Agent | null {
    return this.agents.get(agentId) ?? null;
  }

  listAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  getStatus(agentId: string): AgentStatus | null {
    return this.statuses.get(agentId) ?? null;
  }

  run(agentId: string, input: string): AgentResult {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    this.statuses.set(agentId, { agentId, state: "running", currentStep: "thinking" });

    const steps: AgentStep[] = [
      { action: "think", input, output: "Analyzing input...", reasoning: "Understanding the request" },
      { action: "respond", input: "analysis", output: `[stub output for "${input}"]`, reasoning: "Generating response" },
    ];

    const tokensUsed = Math.ceil(input.length / 4) + 50;
    this.statuses.set(agentId, { agentId, state: "completed" });

    return {
      agentId,
      output: steps[steps.length - 1].output as string,
      steps,
      tokensUsed,
    };
  }
}