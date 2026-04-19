import pino from 'pino';

  const logger = pino({ name: 'infra-gitops' });

  export * from './types';
  export { GitOpsSyncService } from './sync';
  export { GitOpsReconciler, runReconcileController } from './reconciler';

  export async function bootstrap(): Promise<void> {
    logger.info('infra-gitops initialized (real k8s mode via @kubernetes/client-node)');
  }
  