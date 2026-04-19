/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface LLMResponse { content: string; model: string; tokens: { prompt: number; completion: number; total: number }; finishReason: string; }

export interface LLMChunk { content: string; done: boolean; }

export interface LLMModel { id: string; name: string; provider: string; contextLength: number; }

export interface Agent { id: string; name: string; model: string; tools: string[]; systemPrompt: string; }

export interface AgentResult { agentId: string; output: string; steps: AgentStep[]; tokensUsed: number; }

export interface AgentStep { action: string; input: unknown; output: unknown; reasoning: string; }

export interface AgentStatus { agentId: string; state: "idle" | "running" | "completed" | "error"; currentStep?: string; }

export interface SearchResult { id: string; content: string; score: number; metadata: Record<string, unknown>; }

export interface RAGResponse { answer: string; sources: SearchResult[]; model: string; }

export interface Collection { id: string; name: string; documentCount: number; createdAt: Date; }
