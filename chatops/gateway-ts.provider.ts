/**
 * Gateway Service - Provider Pattern Version
 * Transformed to use MetricsCapability and LoggingCapability for platform independence
 */

import type { MetricsCapability } from '../packages/capabilities/src/metrics';
import type { LoggingCapability } from '../packages/capabilities/src/logging';

export interface GatewayConfig {
  port?: number;
  engineUrl?: string;
}

export interface GatewayResponse {
  ok: boolean;
  data?: any;
  error?: string;
}

/**
 * Gateway Service using Provider Pattern
 * 
 * Supports:
 * - Native: Local HTTP routing without external dependencies
 * - Hybrid: External services with fallback
 * - Connected: Full external service integration
 */
export class GatewayProvider {
  private metrics: MetricsCapability | null = null;
  private logger: LoggingCapability | null = null;
  private initialized = false;

  constructor(
    private providerFactory: any,
    private config: GatewayConfig = {}
  ) {}

  /**
   * Initialize the gateway
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.metrics = await this.providerFactory.getMetricsProvider();
      this.logger = await this.providerFactory.getLoggingProvider();
      
      await this.metrics.initialize();
      await this.logger.initialize();
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Gateway:', error);
      throw error;
    }
  }

  /**
   * Handle health check request
   */
  async handleHealth(): Promise<GatewayResponse> {
    await this.log('info', 'Health check requested');
    
    // Record metric
    if (this.metrics) {
      await this.metrics.recordMetric({
        name: 'gateway_health_checks_total',
        value: 1,
        type: 'counter',
        labels: { status: 'ok' },
      });
    }

    return { ok: true };
  }

  /**
   * Handle passthrough request
   */
  async handlePassthrough(target: string): Promise<GatewayResponse> {
    await this.log('info', `Passthrough requested for target: ${target}`);

    // Record metric
    if (this.metrics) {
      await this.metrics.recordMetric({
        name: 'gateway_passthrough_requests_total',
        value: 1,
        type: 'counter',
        labels: { target },
      });
    }

    // Native mode: Return stub response
    // In hybrid/connected mode, this would forward to the actual target
    return {
      ok: true,
      data: {
        target,
        note: 'stub passthrough (native mode)',
        timestamp: Date.now(),
      },
    };
  }

  /**
   * Handle request routing
   */
  async routeRequest(pathname: string, query: Record<string, string>): Promise<GatewayResponse> {
    await this.log('info', `Routing request: ${pathname}`);

    // Record routing metric
    if (this.metrics) {
      await this.metrics.recordMetric({
        name: 'gateway_requests_total',
        value: 1,
        type: 'counter',
        labels: { path: pathname },
      });
    }

    switch (pathname) {
      case '/healthz':
        return this.handleHealth();

      case '/api/passthrough':
        const target = query.target || 'engine';
        return this.handlePassthrough(target);

      case '/metrics':
        return this.getMetrics();

      default:
        await this.log('warn', `Unknown path: ${pathname}`);
        return {
          ok: false,
          error: 'not found',
        };
    }
  }

  /**
   * Get collected metrics
   */
  async getMetrics(): Promise<GatewayResponse> {
    if (!this.metrics) {
      return {
        ok: true,
        data: '# Metrics provider not initialized\n',
      };
    }

    try {
      const metricsText = await this.metrics.exportMetrics();
      return {
        ok: true,
        data: metricsText,
      };
    } catch (error: any) {
      await this.log('error', `Failed to export metrics: ${error.message}`);
      return {
        ok: false,
        error: error.message,
      };
    }
  }

  /**
   * Start the HTTP server
   */
  async start(): Promise<void> {
    await this.initialize();
    
    const http = await import('node:http');
    const { URL } = await import('node:url');

    const port = this.config.port || Number(process.env.PORT) || 8081;

    const server = http.createServer(async (req, res) => {
      const startTime = Date.now();

      try {
        const u = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        const query: Record<string, string> = {};
        u.searchParams.forEach((v, k) => { query[k] = v; });

        const result = await this.routeRequest(u.pathname, query);

        // Set response headers
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        
        if (result.ok) {
          res.statusCode = 200;
        } else if (result.error === 'not found') {
          res.statusCode = 404;
        } else {
          res.statusCode = 500;
        }

        res.end(JSON.stringify(result.data || result));
      } catch (error: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: error.message }));
      }

      // Record request duration
      if (this.metrics) {
        const duration = Date.now() - startTime;
        await this.metrics.recordMetric({
          name: 'gateway_request_duration_ms',
          value: duration,
          type: 'histogram',
          labels: { method: req.method || 'GET' },
        });
      }
    });

    return new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`gateway-ts listening on :${port}`);
        resolve();
      });
    });
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.metrics || !this.logger) return false;
    
    try {
      const [metricsHealth, loggerHealth] = await Promise.all([
        this.metrics.healthCheck(),
        this.logger.healthCheck(),
      ]);

      return metricsHealth.healthy && loggerHealth.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.metrics) await this.metrics.shutdown();
    if (this.logger) await this.logger.shutdown();
    this.initialized = false;
  }

  private async log(level: string, message: string, context?: any): Promise<void> {
    if (this.logger) {
      await this.logger.log({ level: level as any, message, context });
    } else {
      console.log(`[${level}] ${message}`, context || '');
    }
  }
}

/**
 * Factory function to create Gateway instance
 */
export async function createGateway(
  providerFactory: any,
  config?: GatewayConfig
): Promise<GatewayProvider> {
  const gateway = new GatewayProvider(providerFactory, config);
  await gateway.initialize();
  return gateway;
}