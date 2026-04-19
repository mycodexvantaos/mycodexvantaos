/**
 * MyCodexVantaOS Capabilities Package
 * 
 * 統一的能力介面定義，實現平台獨立性原則
 */

// 基礎介面
export * from './base';

// 核心能力
export * from './code-synthesis';
export * from './framework-detection';
export * from './storage';
export * from './auth';
export * from './truth-history';
export * from './metrics';
export * from './logging';

// 類型導出
export type {
  CapabilityBase,
  CapabilitySource,
  RuntimeMode,
  HealthCheckResult,
  ProviderConfig,
  ProviderResolutionOptions,
  ProviderResolutionResult,
  FallbackStrategy,
  FallbackTrigger,
  CapabilityRegistration,
} from './base';

export type {
  CodeSynthesisCapability,
  SynthesisOptions,
  SynthesisResult,
  AnalysisOptions,
  AnalysisResult,
  NativeSynthesisConfig,
  ExternalSynthesisConfig,
  HybridSynthesisConfig,
} from './code-synthesis';

export type {
  FrameworkDetectionCapability,
  DetectionOptions,
  DetectionResult,
  DetectedFramework,
  DetectedLanguage,
  DetectedTool,
  ProjectStructure,
  NativeDetectionConfig,
  FrameworkRule,
} from './framework-detection';

export type {
  StorageCapability,
  StorageOptions,
  FileInfo,
  ListOptions,
  ListResult,
  NativeStorageConfig,
  ExternalStorageConfig,
} from './storage';

export type {
  AuthCapability,
  UserInfo,
  AuthResult,
  TokenVerificationResult,
  SessionInfo,
  LoginOptions,
  NativeAuthConfig,
  ExternalAuthConfig,
} from './auth';

export type {
  TruthHistoryCapability,
  HistoryEntry,
  HistoryQueryOptions,
  HistoryQueryResult,
  AggregationOptions,
  AggregationResult,
  SnapshotInfo,
  NativeTruthHistoryConfig,
  ExternalTruthHistoryConfig,
} from './truth-history';

export type {
  MetricsCapability,
  MetricType,
  MetricLabels,
  MetricData,
  CounterOptions,
  GaugeOptions,
  HistogramOptions,
  MetricsQueryOptions,
  MetricsQueryResult,
  NativeMetricsConfig,
  ExternalMetricsConfig,
} from './metrics';

export type {
  LoggingCapability,
  LogLevel,
  LogEntry,
  LogOptions,
  LogQueryOptions,
  LogQueryResult,
  LogStatistics,
  NativeLoggingConfig,
  ExternalLoggingConfig,
} from './logging';