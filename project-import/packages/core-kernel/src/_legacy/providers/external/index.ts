/**
 * CodexvantaOS — External Provider Barrel Export
 * 
 * Example external (third-party) provider implementations.
 * These are OPTIONAL CONNECTORS — the platform functions without them.
 * 
 * Users can implement their own external providers by:
 *  1. Importing the corresponding interface from '@codexvanta/interfaces'
 *  2. Creating a class that implements the interface with mode = 'external'
 *  3. Registering it with the ProviderRegistry at startup
 * 
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  External Providers — Connector Layer Examples                          │
 * ├──────────────────────────────────────────────────────────────────────────┤
 * │  SupabaseDatabaseProvider       │  PostgreSQL via Supabase              │
 * │  RedisStateStoreProvider        │  Redis for state + pub/sub            │
 * │  GitHubRepoProvider             │  GitHub API for repo operations       │
 * └──────────────────────────────────────────────────────────────────────────┘
 * 
 * More external providers can be added:
 *  - Auth: Auth0, Supabase Auth, Firebase Auth, Clerk
 *  - Storage: AWS S3, GCS, Azure Blob, Cloudflare R2
 *  - Queue: RabbitMQ, AWS SQS, BullMQ (Redis)
 *  - Deploy: GitHub Actions, Vercel, AWS CodeDeploy
 *  - Security: Snyk, Trivy, SonarQube
 *  - Observability: Datadog, Prometheus+Grafana, New Relic
 *  - Notification: Slack, Discord, SendGrid, Twilio
 */

export { SupabaseDatabaseProvider } from './database-supabase';
export { RedisStateStoreProvider } from './state-store-redis';
export { GitHubRepoProvider } from './repo-github';