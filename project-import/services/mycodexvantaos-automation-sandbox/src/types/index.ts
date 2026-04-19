/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface Sandbox { id: string; name: string; status: "creating" | "running" | "paused" | "terminated"; image: string; createdAt: Date; resources: ResourceLimits; }

export interface ResourceLimits { cpuCores: number; memoryMB: number; diskMB: number; networkBandwidth: string; }

export interface ResourceUsage { cpuPercent: number; memoryUsedMB: number; diskUsedMB: number; networkIO: { rx: number; tx: number }; }
