import { ValidationProvider, ValidationResult, UserContext } from '../../types';

export class NativeValidationProvider implements ValidationProvider {
  readonly capability = 'validation';
  private validations: Map<string, ValidationResult> = new Map();

  async initialize(config?: any): Promise<void> {
    console.log('[NativeValidationProvider] Initialized in native mode');
  }

  async healthCheck(): Promise<{ status: string; timestamp: number }> {
    return { status: 'healthy', timestamp: Date.now() };
  }

  async shutdown(): Promise<void> {
    this.validations.clear();
    console.log('[NativeValidationProvider] Shut down');
  }

  async validateDocument(fileId: string, context: UserContext): Promise<ValidationResult> {
    if (context.usedQuota >= context.monthlyQuota) {
      throw new Error('Quota exceeded');
    }

    const taskId = 'val-' + Date.now().toString() + '-' + Math.random().toString(36).substring(7);
    
    const result: ValidationResult = {
      id: taskId,
      originalFileName: fileId,
      status: 'PROCESSING',
      createdAt: new Date().toISOString()
    };
    
    this.validations.set(taskId, result);

    setTimeout(() => {
      const completedResult: ValidationResult = {
        ...result,
        status: 'COMPLETED',
        analysis: {
          overallRiskLevel: 'LOW',
          confidence: 95,
          createdAt: new Date().toISOString()
        }
      };
      this.validations.set(taskId, completedResult);
    }, 2000);

    return result;
  }

  async getValidationStatus(taskId: string): Promise<ValidationResult> {
    const result = this.validations.get(taskId);
    if (!result) {
      throw new Error('Validation task not found');
    }
    return result;
  }
}
