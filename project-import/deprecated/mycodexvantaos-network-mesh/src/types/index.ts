/**
 * CodexvantaOS — Type definitions
 * Auto-generated for Provider-agnostic architecture v2.0
 */

export interface ServiceInstance { id: string; name: string; host: string; port: number; healthy: boolean; metadata: Record<string, string>; }

export interface GatewayRoute { path: string; method: string; target: string; middleware: string[]; }

export interface GatewayResponse { statusCode: number; body: unknown; headers: Record<string, string>; }
