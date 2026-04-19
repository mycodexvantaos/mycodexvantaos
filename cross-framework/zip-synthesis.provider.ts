/**
 * ZIP Synthesis Platform - Provider Pattern Version
 * Transformed to use FrameworkDetectionCapability for platform independence
 */

import type { FrameworkDetectionCapability, FrameworkInfo } from '../packages/capabilities/src/framework-detection';

export type FrameworkType = "TypeScript" | "TypeScript/Node" | "JavaScript/Node" | "Python" | "Go" | "Rust" | "Mixed" | "error";

export type AnalysisStatus = "pending" | "analyzing" | "done" | "error";

export interface FileEntry {
  name: string;
}

export interface AnalysisResult {
  tags: string[];
  overview: string;
  architecture: string;
  value: string;
}

export interface ZipItem {
  id: number;
  name: string;
  files: FileEntry[];
  type: FrameworkType;
  status: AnalysisStatus;
  analysis: AnalysisResult | null;
  error: string | null;
}

export interface SynthesisResult {
  strategy: string;
  conflicts: Array<{ issue: string; solution: string }>;
  architecture: string;
  contributions: Array<{ version: string; contribution: string }>;
  actionPlan: string[];
}

/**
 * ZIP Synthesis using Provider Pattern
 */
export class ZipSynthesis {
  private frameworkDetector: FrameworkDetectionCapability | null = null;
  private initialized = false;

  constructor(private providerFactory: any) {}

  /**
   * Initialize the synthesis engine
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.frameworkDetector = await this.providerFactory.getFrameworkDetectionProvider();
      await this.frameworkDetector.initialize();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize ZipSynthesis:', error);
      throw error;
    }
  }

  /**
   * Detect framework type from files
   * Uses the Provider pattern for platform independence
   */
  async detectFrameworkType(files: FileEntry[]): Promise<FrameworkType> {
    this.ensureInitialized();

    try {
      // Use the framework detection capability
      const result = await this.frameworkDetector!.detect({
        files: files.map(f => f.name),
        content: undefined, // Could be enhanced to pass file contents
      });

      // Map detected framework to our FrameworkType
      return this.mapToFrameworkType(result.detected);
    } catch (error) {
      console.error('Framework detection error:', error);
      return 'error';
    }
  }

  /**
   * Map framework name to FrameworkType
   */
  private mapToFrameworkType(framework: string): FrameworkType {
    const frameworkMap: Record<string, FrameworkType> = {
      'react': 'TypeScript',
      'vue': 'TypeScript',
      'angular': 'TypeScript',
      'nextjs': 'TypeScript',
      'node': 'JavaScript/Node',
      'typescript': 'TypeScript/Node',
      'python': 'Python',
      'django': 'Python',
      'fastapi': 'Python',
      'flask': 'Python',
      'go': 'Go',
      'rust': 'Rust',
      'mixed': 'Mixed',
    };

    const lower = framework.toLowerCase();
    for (const [key, value] of Object.entries(frameworkMap)) {
      if (lower.includes(key)) {
        return value;
      }
    }

    return 'Mixed';
  }

  /**
   * Create a ZIP item with detected framework
   */
  async createZipItem(
    id: number,
    name: string,
    files: FileEntry[]
  ): Promise<ZipItem> {
    const frameworkType = await this.detectFrameworkType(files);

    return {
      id,
      name,
      files,
      type: frameworkType,
      status: 'pending',
      analysis: null,
      error: null,
    };
  }

  /**
   * Analyze ZIP content
   */
  async analyzeZip(
    zipItem: ZipItem,
    analysisProvider?: any
  ): Promise<AnalysisResult> {
    this.ensureInitialized();

    try {
      // Update status
      zipItem.status = 'analyzing';

      // If we have an analysis provider, use it
      if (analysisProvider) {
        const result = await analysisProvider.analyze({
          files: zipItem.files.map(f => f.name),
          framework: zipItem.type,
        });
        
        zipItem.analysis = result;
        zipItem.status = 'done';
        return result;
      }

      // Fallback to basic analysis using framework detection
      const frameworkInfo = await this.frameworkDetector!.detect({
        files: zipItem.files.map(f => f.name),
      });

      const result: AnalysisResult = {
        tags: this.extractTags(frameworkInfo),
        overview: `Detected ${frameworkInfo.detected} framework`,
        architecture: frameworkInfo.structure || 'Standard project structure',
        value: this.assessValue(zipItem),
      };

      zipItem.analysis = result;
      zipItem.status = 'done';
      return result;
    } catch (error: any) {
      zipItem.status = 'error';
      zipItem.error = error.message || 'Analysis failed';
      throw error;
    }
  }

  /**
   * Extract tags from framework info
   */
  private extractTags(info: FrameworkInfo): string[] {
    const tags: string[] = [];
    
    if (info.detected) {
      tags.push(info.detected.toLowerCase());
    }
    
    if (info.confidence > 0.8) {
      tags.push('high-confidence');
    } else if (info.confidence > 0.5) {
      tags.push('medium-confidence');
    }

    // Add package manager tags
    if (info.features) {
      for (const feature of info.features) {
        if (feature.includes('package')) {
          tags.push(feature);
        }
      }
    }

    return tags;
  }

  /**
   * Assess the value of a ZIP
   */
  private assessValue(zipItem: ZipItem): string {
    const fileCount = zipItem.files.length;
    
    if (fileCount > 100) {
      return 'Large codebase with significant functionality';
    } else if (fileCount > 50) {
      return 'Medium-sized project with multiple features';
    } else if (fileCount > 20) {
      return 'Compact project with focused functionality';
    } else {
      return 'Small utility or prototype project';
    }
  }

  /**
   * Generate synthesis result
   */
  async generateSynthesis(
    zipItems: ZipItem[]
  ): Promise<SynthesisResult> {
    this.ensureInitialized();

    const conflicts: Array<{ issue: string; solution: string }> = [];
    const contributions: Array<{ version: string; contribution: string }> = [];
    const actionPlan: string[] = [];

    // Analyze conflicts and generate synthesis
    const frameworks = new Set(zipItems.map(z => z.type));
    
    if (frameworks.size > 1) {
      conflicts.push({
        issue: 'Multiple framework types detected',
        solution: 'Consider separating concerns or using micro-frontends',
      });
    }

    // Generate action plan
    actionPlan.push('1. Review detected frameworks and validate accuracy');
    actionPlan.push('2. Analyze dependency conflicts');
    actionPlan.push('3. Plan integration strategy');
    actionPlan.push('4. Set up shared tooling');
    actionPlan.push('5. Establish code review process');

    return {
      strategy: frameworks.size > 1 ? 'multi-framework' : 'unified',
      conflicts,
      architecture: 'modular-monolith',
      contributions,
      actionPlan,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.frameworkDetector) return false;
    
    try {
      const result = await this.frameworkDetector.healthCheck();
      return result.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.frameworkDetector) {
      await this.frameworkDetector.shutdown();
    }
    this.initialized = false;
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.frameworkDetector) {
      throw new Error('ZipSynthesis not initialized. Call initialize() first.');
    }
  }
}

/**
 * Factory function to create ZipSynthesis instance
 */
export async function createZipSynthesis(providerFactory: any): Promise<ZipSynthesis> {
  const synthesis = new ZipSynthesis(providerFactory);
  await synthesis.initialize();
  return synthesis;
}

/**
 * Legacy-compatible exports
 */
let _synthesisInstance: ZipSynthesis | null = null;

async function getSynthesis(): Promise<ZipSynthesis> {
  if (!_synthesisInstance) {
    const { getProviderFactory } = await import('../packages/capabilities/src/provider-factory');
    const factory = getProviderFactory();
    _synthesisInstance = await createZipSynthesis(factory);
  }
  return _synthesisInstance;
}

/**
 * Legacy function: Detect framework type
 */
export async function detectFrameworkType(files: FileEntry[]): Promise<FrameworkType> {
  const synthesis = await getSynthesis();
  return synthesis.detectFrameworkType(files);
}