import { UniversalPipeline, PipelineExecutionOptions } from './pipeline/UniversalPipeline';
import { IntentAnalyzer } from './analyzers/IntentAnalyzer';
import { RequirementAnalyzer } from './analyzers/RequirementAnalyzer';
import { EngineeringReviewer } from './reviewers/EngineeringReviewer';
import { AdapterRegistry } from './registry/AdapterRegistry';
import { StructuredProjectOutput, UserIntent, ProjectRequirements, ReviewReport } from './types';

export class EngineeringCoreEngine {
  private static instance: EngineeringCoreEngine;

  private constructor() {}

  public static getInstance(): EngineeringCoreEngine {
    if (!EngineeringCoreEngine.instance) {
      EngineeringCoreEngine.instance = new EngineeringCoreEngine();
    }
    return EngineeringCoreEngine.instance;
  }

  /**
   * Universal generation pipeline execution
   */
  public async generateProject(options: PipelineExecutionOptions): Promise<StructuredProjectOutput> {
    return UniversalPipeline.execute(options);
  }

  /**
   * Fast Intent classification
   */
  public analyzeIntent(prompt: string, existingFilesCount: number = 0): UserIntent {
    return IntentAnalyzer.analyze(prompt, existingFilesCount);
  }

  /**
   * Requirement extraction
   */
  public extractRequirements(
    prompt: string,
    blockchain?: string,
    language?: string,
    framework?: string
  ): ProjectRequirements {
    return RequirementAnalyzer.extract(prompt, blockchain, language, framework);
  }

  /**
   * Quality and Security review
   */
  public reviewProject(project: StructuredProjectOutput): ReviewReport {
    return EngineeringReviewer.review(project);
  }

  /**
   * Adapter lookup & ecosystem discovery
   */
  public get adapters() {
    return AdapterRegistry;
  }
}

export const EngineeringCore = EngineeringCoreEngine.getInstance();
