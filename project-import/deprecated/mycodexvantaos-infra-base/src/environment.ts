/**
 * CodexvantaOS — infra-base / EnvironmentService
 * In-memory environment configuration management
 */

import type { Environment, EnvironmentConfig } from "./types";

export class EnvironmentService {
  private environments = new Map<string, Environment>();
  private configs = new Map<string, EnvironmentConfig>();

  async create(name: string, type: Environment["type"] = "development"): Promise<Environment> {
    const env: Environment = {
      id: `env-${name}-${Date.now()}`,
      name,
      type,
      status: "active",
      createdAt: new Date(),
    };
    this.environments.set(env.id, env);
    this.configs.set(env.id, {
      envId: env.id,
      variables: {},
      secrets: [],
      resources: { cpu: "0", memory: "0", storage: "0", network: "0" },
    });
    return env;
  }

  async get(envId: string): Promise<Environment | null> {
    return this.environments.get(envId) ?? null;
  }

  async list(): Promise<Environment[]> {
    return Array.from(this.environments.values());
  }

  async delete(envId: string): Promise<boolean> {
    this.configs.delete(envId);
    return this.environments.delete(envId);
  }

  async setVariable(envId: string, key: string, value: string): Promise<void> {
    const cfg = this.configs.get(envId);
    if (!cfg) throw new Error(`Environment not found: ${envId}`);
    cfg.variables[key] = value;
  }

  async getVariables(envId: string): Promise<Record<string, string>> {
    const cfg = this.configs.get(envId);
    if (!cfg) throw new Error(`Environment not found: ${envId}`);
    return { ...cfg.variables };
  }

  async clone(sourceEnvId: string, newName: string): Promise<Environment> {
    const source = this.environments.get(sourceEnvId);
    if (!source) throw new Error(`Source environment not found: ${sourceEnvId}`);
    const sourceCfg = this.configs.get(sourceEnvId);
    const newEnv = await this.create(newName, source.type);
    if (sourceCfg) {
      this.configs.set(newEnv.id, {
        envId: newEnv.id,
        variables: { ...sourceCfg.variables },
        secrets: [...sourceCfg.secrets],
        resources: { ...sourceCfg.resources },
      });
    }
    return newEnv;
  }

  async detectMode(): Promise<"native" | "connected" | "hybrid"> {
    const hasRedis = !!process.env["ORCH_STATE_HOST"];
    const hasGithub = !!process.env["ORCH_GITHUB_TOKEN"];
    const hasSlack = !!process.env["SLACK_WEBHOOK_URL"];
    const count = [hasRedis, hasGithub, hasSlack].filter(Boolean).length;
    if (count === 0) return "native";
    if (count >= 3) return "connected";
    return "hybrid";
  }
}