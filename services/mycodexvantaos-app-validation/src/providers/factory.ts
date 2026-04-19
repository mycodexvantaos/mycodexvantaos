import { ValidationProvider, ValidationResult, UserContext } from '../types';
import { NativeValidationProvider } from './native/validation-provider';

// Factory to resolve provider based on environment contract
export class ValidationProviderFactory {
  static createProvider(): ValidationProvider {
    const mode = process.env.MYCODEXVANTAOS_MODE || 'hybrid';
    
    switch (mode) {
      case 'native':
        return new NativeValidationProvider() as unknown as ValidationProvider;
      case 'connected':
        // Return External/Connected Provider (e.g., connected/validation-llm)
        console.warn('Connected mode configured, but provider not yet implemented. Falling back if allowed.');
        return new NativeValidationProvider() as unknown as ValidationProvider;
      case 'hybrid':
      default:
        // Hybrid: Try external, fallback to native
        return new NativeValidationProvider() as unknown as ValidationProvider;
    }
  }
}
