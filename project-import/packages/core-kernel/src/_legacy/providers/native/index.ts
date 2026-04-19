/**
 * CodexvantaOS — Native Provider Barrel Export
 * 
 * All 12 native (zero-dependency) provider implementations.
 * These ensure the platform operates fully without ANY third-party service.
 * 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Native Mode — Platform Minimum Closed Loop                            │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │  Provider                       │  Backend                             │
 * │ ─────────────────────────────── │ ─────────────────────────────────────│
 * │  NativeDatabaseProvider         │  SQLite / in-memory                  │
 * │  NativeStorageProvider          │  Filesystem                          │
 * │  NativeAuthProvider             │  JWT + file-based user store         │
 * │  NativeQueueProvider            │  In-memory + file persistence        │
 * │  NativeStateStoreProvider       │  In-memory KV + file snapshots       │
 * │  NativeSecretsProvider          │  AES-256-GCM encrypted file vault    │
 * │  NativeRepoProvider             │  Local Git CLI                       │
 * │  NativeDeployProvider           │  Local process / Docker              │
 * │  NativeValidationProvider       │  Built-in linters & schema checks    │
 * │  NativeSecurityScannerProvider  │  Pattern-based secret/vuln scanner   │
 * │  NativeObservabilityProvider    │  File logs + in-memory metrics/traces│
 * │  NativeNotificationProvider     │  Console + file + webhook            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export { NativeDatabaseProvider } from './database';
export { NativeStorageProvider } from './storage';
export { NativeAuthProvider } from './auth';
export { NativeQueueProvider } from './queue';
export { NativeStateStoreProvider } from './state-store';
export { NativeSecretsProvider } from './secrets';
export { NativeRepoProvider } from './repo';
export { NativeDeployProvider } from './deploy';
export { NativeValidationProvider } from './validation';
export { NativeSecurityScannerProvider } from './security';
export { NativeObservabilityProvider } from './observability';
export { NativeNotificationProvider } from './notification';