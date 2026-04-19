export interface ValidationResult {
  id: string;
  originalFileName: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: string;
  errorMessage?: string;
  analysis?: {
    overallRiskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    confidence: number;
    createdAt: string;
  };
}

export interface UserContext {
  userId: string;
  name: string;
  monthlyQuota: number;
  usedQuota: number;
  subscriptionPlan: 'STARTER' | 'STANDARD' | 'ENTERPRISE';
}

export interface ValidationProvider {
  readonly capability: 'validation';
  initialize(config?: any): Promise<void>;
  healthCheck(): Promise<{ status: string; timestamp: number }>;
  shutdown(): Promise<void>;
  
  validateDocument(fileId: string, context: UserContext): Promise<ValidationResult>;
  getValidationStatus(taskId: string): Promise<ValidationResult>;
}
