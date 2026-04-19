import { ValidationProviderFactory } from './providers/factory';
import { UserContext } from './types';

// Mock system bootstrap
async function bootstrap() {
  console.log('Bootstrapping tier-3 application: mycodexvantaos-app-validation');
  
  const provider = ValidationProviderFactory.createProvider();
  await provider.initialize();
  
  const health = await provider.healthCheck();
  console.log('[System] Validation Provider Health:', health);
  
  const mockUser: UserContext = {
    userId: 'u-123',
    name: 'Test Administrator',
    monthlyQuota: 10,
    usedQuota: 0,
    subscriptionPlan: 'ENTERPRISE'
  };

  console.log('\\n[TEST] Initiating document validation...');
  const result = await provider.validateDocument('confidential_agreement_v2.pdf', mockUser);
  console.log('[TEST] Sync Result (Processing):', result);
  
  setTimeout(async () => {
    const finalResult = await provider.getValidationStatus(result.id);
    console.log('\\n[TEST] Async Polling Result (Completed):', finalResult);
    
    await provider.shutdown();
  }, 2500);
}

// Ensure execution when run directly
if (require.main === module) {
  bootstrap().catch(console.error);
}
