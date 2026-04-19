/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface ProvisionResult { environmentId: string; status: string; endpoints: Record<string, string>; createdAt: Date; }

export interface InfraStatus { environments: number; healthy: number; unhealthy: number; resources: ResourceSummary; }

export interface ResourceSummary { cpu: string; memory: string; storage: string; network: string; }

export interface Environment { id: string; name: string; type: "development" | "staging" | "production"; status: string; createdAt: Date; }

export interface EnvironmentConfig { envId: string; variables: Record<string, string>; secrets: string[]; resources: ResourceSummary; }
