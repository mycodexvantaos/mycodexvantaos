/**
 * ChatOps Module Index
 * Platform-Independent Provider Pattern Implementation
 * 
 * This module provides ChatOps functionality (GitHub automation, gateway services)
 * that works in any runtime environment with zero external dependencies.
 * 
 * Runtime Modes:
 * - native: Local file system operations, no GitHub API required
 * - hybrid: GitHub API with fallback to local operations
 * - connected: GitHub API only, requires network connectivity
 */

// Re-export types
export type { FixerContext, FixResult } from './auto-fix-bot.provider';
export type { GatewayConfig, GatewayResponse } from './gateway-ts.provider';

// Re-export classes
export { 
  BaseFixer, 
  NamingFixer, 
  SecurityFixer, 
  DependencyFixer, 
  AutoFixBot,
  createAutoFixBot,
} from './auto-fix-bot.provider';

export { 
  GatewayProvider, 
  createGateway,
} from './gateway-ts.provider';

// Provider factory for dependency injection
export { getProviderFactory, ProviderFactory } from '../packages/capabilities/src/provider-factory';

// Runtime configuration
export { getRuntimeConfig, RuntimeConfig, RuntimeMode } from '../packages/capabilities/src/runtime-config';

/**
 * Initialize all ChatOps modules
 * Call this once at application startup
 */
export async function initializeChatOps(config?: {
  runtimeMode?: 'native' | 'hybrid' | 'connected';
  gatewayPort?: number;
  githubToken?: string;
  webhookSecret?: string;
}): Promise<{
  autoFixBot: import('./auto-fix-bot.provider').AutoFixBot;
  gateway: import('./gateway-ts.provider').GatewayProvider;
}> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const { createAutoFixBot } = await import('./auto-fix-bot.provider');
  const { createGateway } = await import('./gateway-ts.provider');

  const providerFactory = getProviderFactory();

  const [autoFixBot, gateway] = await Promise.all([
    createAutoFixBot(providerFactory, {
      token: config?.githubToken,
      webhookSecret: config?.webhookSecret,
    }),
    createGateway(providerFactory, {
      port: config?.gatewayPort,
    }),
  ]);

  return { autoFixBot, gateway };
}

/**
 * Health check all ChatOps modules
 */
export async function healthCheckAll(): Promise<{
  autoFixBot: boolean;
  gateway: boolean;
  overall: boolean;
}> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const factory = getProviderFactory();

  const [autoFixBotHealth, gatewayHealth] = await Promise.allSettled([
    (await factory.getRepositoryProvider()).healthCheck(),
    (await factory.getMetricsProvider()).healthCheck(),
  ]);

  const autoFixBot = autoFixBotHealth.status === 'fulfilled' && 
    'healthy' in autoFixBotHealth.value && autoFixBotHealth.value.healthy;
  const gateway = gatewayHealth.status === 'fulfilled' && 
    'healthy' in gatewayHealth.value && gatewayHealth.value.healthy;

  return {
    autoFixBot,
    gateway,
    overall: autoFixBot && gateway,
  };
}

/**
 * Shutdown all modules
 */
export async function shutdownAll(): Promise<void> {
  const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
  const factory = getProviderFactory();

  const providers = await Promise.all([
    factory.getRepositoryProvider(),
    factory.getMetricsProvider(),
    factory.getLoggingProvider(),
  ]);

  await Promise.all(providers.map(p => p.shutdown()));
}