import pino from 'pino';
  import { GitOpsSyncService } from './sync';

  const logger = pino({ name: 'gitops-reconciler' });

  const RECONCILE_INTERVAL_MS = 60_000; // 60s

  /**
   * GitOps Reconcile Controller
   * 
   * Runs a continuous reconcile loop every 60 seconds.
   * On each tick:
   *   1. Calls detectDrift() — compares desired state vs live cluster state
   *   2. If drift detected, calls sync() — applies manifests via Server-Side Apply
   *   3. Logs the result for observability
   * 
   * This replaces the previous in-memory Map simulation with real kubectl semantics.
   */
  export class GitOpsReconciler {
    private svc: GitOpsSyncService;
    private timer: NodeJS.Timeout | null = null;
    private running = false;
    private reconcileCount = 0;

    constructor(svc: GitOpsSyncService) {
      this.svc = svc;
    }

    start(): void {
      if (this.running) return;
      this.running = true;
      logger.info('GitOps reconcile controller started (60s interval)');
      void this.tick();
      this.timer = setInterval(() => { void this.tick(); }, RECONCILE_INTERVAL_MS);
    }

    stop(): void {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      this.running = false;
      logger.info({ totalReconciles: this.reconcileCount }, 'GitOps reconcile controller stopped');
    }

    private async tick(): Promise<void> {
      const startMs = Date.now();
      this.reconcileCount++;
      try {
        const result = await this.svc.reconcile();
        const elapsedMs = Date.now() - startMs;
        logger.info({
          reconcileNum: this.reconcileCount,
          reconciled: result.reconciled,
          failed: result.failed,
          errors: result.errors,
          elapsedMs,
        }, 'Reconcile tick complete');
      } catch (e: unknown) {
        logger.error({ err: e, reconcileNum: this.reconcileCount }, 'Reconcile tick threw unexpectedly');
      }
    }
  }

  /**
   * Run the reconcile controller as a standalone process.
   * Called when this module is the main entry point.
   */
  export async function runReconcileController(svc: GitOpsSyncService): Promise<void> {
    const controller = new GitOpsReconciler(svc);
    controller.start();

    // Graceful shutdown on SIGTERM (k8s Pod termination)
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received — stopping reconcile controller');
      controller.stop();
      process.exit(0);
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received — stopping reconcile controller');
      controller.stop();
      process.exit(0);
    });

    logger.info('Reconcile controller running — press Ctrl+C to stop');
  }
  