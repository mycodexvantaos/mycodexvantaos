/**
 * CodexvantaOS — NotificationProvider
 * 
 * Abstract interface for notification delivery across channels.
 * Native mode: file-based logs, stdout, local webhook relay
 * External mode: Slack, Discord, Email (SendGrid/SES), SMS (Twilio),
 *                PagerDuty, Microsoft Teams, Telegram, etc.
 * 
 * Covers: multi-channel delivery, templating, scheduling,
 *         delivery tracking, preference management.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationChannel =
  | 'stdout'           // native: console output
  | 'file'             // native: append to log file
  | 'webhook'          // native/external: HTTP POST
  | 'email'
  | 'slack'
  | 'discord'
  | 'teams'
  | 'telegram'
  | 'sms'
  | 'pagerduty'
  | 'custom';

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced' | 'suppressed';

export interface NotificationMessage {
  /** Unique identifier (assigned by provider on send). */
  id?: string;
  /** Target channel(s). */
  channels: NotificationChannel[];
  /** Notification priority — may influence delivery urgency. */
  priority: NotificationPriority;
  /** Subject or title (used for email, Slack header, etc.). */
  subject: string;
  /** Plain text body. */
  body: string;
  /** Rich body (HTML for email, Markdown for Slack/Discord). Optional. */
  richBody?: string;
  /** Structured data payload (for webhook, template variables, etc.). */
  data?: Record<string, unknown>;
  /** Template ID if using templated notifications. */
  templateId?: string;
  /** Template variables to inject. */
  templateVars?: Record<string, unknown>;
  /** Recipient identifiers (email address, Slack channel, user ID, etc.). */
  recipients: string[];
  /** Optional: group/thread to post into (Slack thread_ts, Discord thread, etc.). */
  thread?: string;
  /** Attachments (file paths or URLs). */
  attachments?: NotificationAttachment[];
  /** Optional: scheduled send time (epoch ms). Null = immediate. */
  scheduledAt?: number;
  /** Optional: deduplication key to prevent duplicate sends. */
  deduplicationKey?: string;
  /** Metadata for tracking. */
  metadata?: Record<string, unknown>;
}

export interface NotificationAttachment {
  filename: string;
  content?: Buffer | Uint8Array | string;
  url?: string;
  contentType?: string;
  size?: number;
}

export interface NotificationResult {
  messageId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  sentAt?: number;
  deliveredAt?: number;
  failureReason?: string;
  externalId?: string;       // provider's own message ID
}

export interface NotificationSendResult {
  messageId: string;
  results: NotificationResult[];
  allSucceeded: boolean;
}

export interface ChannelConfig {
  channel: NotificationChannel;
  enabled: boolean;
  config: Record<string, unknown>;
  /** e.g. Slack: { webhookUrl, defaultChannel }, Email: { from, smtpHost }, etc. */
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description?: string;
  channels: NotificationChannel[];
  subjectTemplate: string;     // supports {{variable}} interpolation
  bodyTemplate: string;
  richBodyTemplate?: string;
  variables: string[];          // expected variable names
  createdAt: number;
  updatedAt: number;
}

export interface NotificationPreference {
  recipientId: string;
  channels: {
    channel: NotificationChannel;
    enabled: boolean;
    minPriority?: NotificationPriority;
  }[];
  quietHours?: {
    enabled: boolean;
    startHour: number;   // 0-23
    endHour: number;
    timezone: string;
  };
  suppressedCategories?: string[];
}

export interface NotificationQuery {
  channel?: NotificationChannel;
  status?: DeliveryStatus;
  priority?: NotificationPriority;
  recipient?: string;
  since?: number;
  until?: number;
  limit?: number;
}

export interface NotificationHealth {
  healthy: boolean;
  mode: 'native' | 'external';
  provider: string;
  configuredChannels: NotificationChannel[];
  activeChannels: NotificationChannel[];
  pendingCount?: number;
  failedLast24h?: number;
  details?: Record<string, unknown>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface NotificationProvider {
  readonly providerId: string;
  readonly mode: 'native' | 'external';

  /** Initialise provider (connect to services, load templates, etc.). */
  init(): Promise<void>;

  // ── Sending ─────────────────────────────────────────────────────────────

  /** Send a notification across one or more channels. */
  send(message: NotificationMessage): Promise<NotificationSendResult>;

  /** Send a notification using a template. */
  sendTemplate(templateId: string, recipients: string[], variables: Record<string, unknown>, options?: {
    channels?: NotificationChannel[];
    priority?: NotificationPriority;
    scheduledAt?: number;
  }): Promise<NotificationSendResult>;

  /** Send to multiple recipient groups in batch. */
  sendBatch?(messages: NotificationMessage[]): Promise<NotificationSendResult[]>;

  // ── Delivery Tracking ───────────────────────────────────────────────────

  /** Get the delivery status of a sent notification. */
  getStatus(messageId: string): Promise<NotificationResult[]>;

  /** Query notification history. */
  queryHistory(query: NotificationQuery): Promise<NotificationResult[]>;

  /** Retry a failed notification. */
  retry?(messageId: string, channel?: NotificationChannel): Promise<NotificationSendResult>;

  // ── Channel Management ──────────────────────────────────────────────────

  /** List configured notification channels. */
  listChannels(): Promise<ChannelConfig[]>;

  /** Configure a notification channel. */
  configureChannel?(channel: NotificationChannel, config: Record<string, unknown>): Promise<ChannelConfig>;

  /** Test a channel configuration by sending a test message. */
  testChannel?(channel: NotificationChannel): Promise<NotificationResult>;

  // ── Templates ───────────────────────────────────────────────────────────

  /** List available notification templates. */
  listTemplates?(): Promise<NotificationTemplate[]>;

  /** Get a template by ID. */
  getTemplate?(templateId: string): Promise<NotificationTemplate | null>;

  /** Create or update a notification template. */
  upsertTemplate?(template: Omit<NotificationTemplate, 'createdAt' | 'updatedAt'>): Promise<NotificationTemplate>;

  /** Delete a template. */
  deleteTemplate?(templateId: string): Promise<void>;

  // ── Preferences ─────────────────────────────────────────────────────────

  /** Get notification preferences for a recipient. */
  getPreferences?(recipientId: string): Promise<NotificationPreference | null>;

  /** Set notification preferences for a recipient. */
  setPreferences?(preference: NotificationPreference): Promise<NotificationPreference>;

  // ── Lifecycle ───────────────────────────────────────────────────────────

  healthcheck(): Promise<NotificationHealth>;
  close(): Promise<void>;
}