/**
 * API Client for Anthropic Claude Integration - Provider Pattern Version
 * Transformed to use CodeSynthesisCapability for platform independence
 */

import type { CodeSynthesisCapability } from '../packages/capabilities/src/code-synthesis';
import type { SynthesisOptions, SynthesisResult } from '../packages/capabilities/src/code-synthesis';

export interface MessageResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export interface AnalysisResult {
  tags: string[];
  overview: string;
  architecture: string;
  value: string;
}

/**
 * API Client using Provider Pattern
 * Can work with Native, External, or Hybrid providers
 */
export class APIClient {
  private provider: CodeSynthesisCapability | null = null;
  private apiKey: string | null = null;

  constructor(private providerFactory: any) {}

  /**
   * Initialize the client with provider
   */
  async initialize(): Promise<void> {
    try {
      this.provider = await this.providerFactory.getCodeSynthesisProvider();
      await this.provider.initialize();
    } catch (error) {
      console.error('Failed to initialize APIClient:', error);
      throw error;
    }
  }

  /**
   * Set API key for external providers
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Validate API key format
   */
  validateApiKey(apiKey: string): boolean {
    return apiKey.length > 0 && apiKey.startsWith('sk-');
  }

  /**
   * Call Claude API using Provider
   * Falls back to native provider if external fails
   */
  async callClaudeAPI(
    prompt: string,
    maxTokens: number = 1000
  ): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }

    try {
      const options: SynthesisOptions = {
        prompt,
        context: {
          maxTokens,
          apiKey: this.apiKey || undefined,
        },
      };

      const result: SynthesisResult = await this.provider.generate(options);
      
      if (!result.success) {
        throw new Error(result.error || 'Synthesis failed');
      }

      return result.content;
    } catch (error) {
      console.error('Provider synthesis error:', error);
      throw error;
    }
  }

  /**
   * Build analysis prompt
   */
  buildAnalysisPrompt(
    zipName: string,
    fileCount: number,
    frameworkType: string,
    fileList: string,
    additionalContext: string
  ): string {
    return `
Analyze this ZIP file and provide insights:

ZIP Name: ${zipName}
Total Files: ${fileCount}
Framework Type: ${frameworkType}

File List (first 50):
${fileList}

Additional Context:
${additionalContext}

Provide analysis in JSON format with these fields:
{
  "tags": ["tag1", "tag2"],
  "overview": "Brief overview",
  "architecture": "Architecture description",
  "value": "Value proposition"
}
  `.trim();
  }

  /**
   * Parse analysis result
   */
  parseAnalysisResult(response: string): AnalysisResult {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          tags: Array.isArray(parsed.tags) ? parsed.tags : [],
          overview: parsed.overview || "No overview available",
          architecture: parsed.architecture || "No architecture description",
          value: parsed.value || "No value description",
        };
      }
    } catch (error) {
      console.error('Error parsing analysis result:', error);
    }

    return {
      tags: ["analyzed"],
      overview: response.slice(0, 200),
      architecture: "Architecture analysis pending",
      value: "Value analysis pending",
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.provider) return false;
    
    try {
      const result = await this.provider.healthCheck();
      return result.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.provider) {
      await this.provider.shutdown();
    }
  }
}

/**
 * Factory function to create APIClient instance
 */
export async function createAPIClient(providerFactory: any): Promise<APIClient> {
  const client = new APIClient(providerFactory);
  await client.initialize();
  return client;
}