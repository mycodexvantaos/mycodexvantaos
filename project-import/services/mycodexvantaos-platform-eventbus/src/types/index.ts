/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface Event { id: string; topic: string; payload: unknown; timestamp: Date; source: string; metadata?: Record<string, string>; }

export interface Subscription { id: string; topic: string; handler: (event: Event) => Promise<void>; filter?: EventFilter; }

export interface EventFilter { sourcePattern?: string; payloadMatch?: Record<string, unknown>; }

export interface EventRoute { id: string; sourceTopic: string; targetTopic: string; filter?: EventFilter; transform?: string; }
