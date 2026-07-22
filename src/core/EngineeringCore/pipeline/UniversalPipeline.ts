import { PipelineContext, StructuredProjectOutput } from '../types';
import { IntentAnalyzer } from '../analyzers/IntentAnalyzer';
import { RequirementAnalyzer } from '../analyzers/RequirementAnalyzer';
import { BlockchainRegistry } from '../adapters/blockchain/BlockchainRegistry';
import { LanguageRegistry } from '../adapters/language/LanguageRegistry';
import { FrameworkRegistry } from '../adapters/framework/FrameworkRegistry';
import { ArchitecturePlanner } from '../planners/ArchitecturePlanner';
import { SecurityPlanner } from '../planners/SecurityPlanner';
import { KnowledgeEngine } from '../knowledge/KnowledgeEngine';
import { EnterprisePromptBuilder } from '../prompts/EnterprisePromptBuilder';
import { ResponseParser } from '../parsers/ResponseParser';
import { Validator } from '../validators/Validator';
import { QualityGateEngine } from '../quality/QualityGateEngine';
import { EngineeringCoreLogger } from '../services/EngineeringCoreLogger';

export interface PipelineExecutionOptions {
  userPrompt: string;
  blockchain?: string;
  language?: string;
  framework?: string;
  existingFiles?: Array<{ path: string; content: string; language: string }>;
  aiExecutor: (systemInstruction: string, prompt: string) => Promise<string>;
  onStepProgress?: (step: string) => void;
}

export class UniversalPipeline {
  static async execute(options: PipelineExecutionOptions): Promise<StructuredProjectOutput> {
    const context: PipelineContext = {
      id: `pipeline-${Date.now()}`,
      userPrompt: options.userPrompt,
      blockchainInput: options.blockchain,
      languageInput: options.language,
      frameworkInput: options.framework,
      existingFiles: options.existingFiles,
      executionLog: [],
    };

    // 1. Intent Analyzer
    EngineeringCoreLogger.logStage(context, 'Intent Analyzer');
    context.intent = IntentAnalyzer.analyze(options.userPrompt, options.existingFiles?.length || 0);

    // 2. Requirement Analyzer
    options.onStepProgress?.('Analyzing Requirements...');
    EngineeringCoreLogger.logStage(context, 'Requirement Analyzer');
    context.requirements = RequirementAnalyzer.extract(
      options.userPrompt,
      options.blockchain,
      options.language,
      options.framework
    );

    // 3. Clarification Engine Check
    if (context.requirements.clarificationQuestions && context.requirements.clarificationQuestions.length > 0) {
      EngineeringCoreLogger.logStage(context, 'Clarification Required', `Low confidence score: ${context.requirements.confidenceScore}`);
      return {
        name: 'Clarification Required',
        description: 'Low confidence requirement specification. Clarification needed.',
        blockchain: context.requirements.blockchain,
        language: context.requirements.language,
        framework: context.requirements.framework,
        contractType: context.requirements.contractType,
        files: [],
        requirements: context.requirements,
        clarificationQuestions: context.requirements.clarificationQuestions,
      };
    }

    // 4, 5, 6. Resolvers (Blockchain, Language, Framework)
    EngineeringCoreLogger.logStage(context, 'Resolvers');
    const chainAdapter = BlockchainRegistry.getAdapter(context.requirements.blockchain);
    const langAdapter = LanguageRegistry.getAdapter(context.requirements.language);
    const fwAdapter = FrameworkRegistry.getAdapter(context.requirements.framework);

    // 7. Architecture Planner
    options.onStepProgress?.('Designing Architecture...');
    EngineeringCoreLogger.logStage(context, 'Architecture Planner');
    context.architecturePlan = ArchitecturePlanner.plan(context.requirements);

    // 8. Security Planner
    options.onStepProgress?.('Planning Security...');
    EngineeringCoreLogger.logStage(context, 'Security Planner');
    context.securityPlan = SecurityPlanner.plan(context.requirements);

    // 9. Knowledge Loader
    EngineeringCoreLogger.logStage(context, 'Knowledge Loader');
    const knowledge = KnowledgeEngine.getKnowledge(
      chainAdapter.id,
      langAdapter.id,
      fwAdapter.id
    );

    // 10. Enterprise Prompt Builder
    EngineeringCoreLogger.logStage(context, 'Enterprise Prompt Builder');
    const { systemInstruction, userPromptText } = EnterprisePromptBuilder.buildPrompt(
      options.userPrompt,
      context.intent,
      context.requirements,
      context.architecturePlan,
      context.securityPlan,
      knowledge
    );
    context.systemPrompt = systemInstruction;

    // 11. Provider Execution
    options.onStepProgress?.('Generating Enterprise Code...');
    EngineeringCoreLogger.logStage(context, 'Provider Execution');
    const rawResponseText = await options.aiExecutor(systemInstruction, userPromptText);
    context.rawResponseText = rawResponseText;

    // 12. Response Parser
    EngineeringCoreLogger.logStage(context, 'Response Parser');
    const parsedProject = ResponseParser.parseAndNormalize(rawResponseText, context.requirements.contractType);

    // 13. Validator
    options.onStepProgress?.('Validating Deployment...');
    EngineeringCoreLogger.logStage(context, 'Validator');
    const validationResult = Validator.validate(parsedProject);
    if (!validationResult.isValid) {
      console.warn('[UniversalPipeline Validator Warnings/Errors]:', validationResult.errors, validationResult.warnings);
    }

    // 14. Quality Gate Engine (Review -> Decision Engine -> Self-Improvement Cycle -> Final Project)
    EngineeringCoreLogger.logStage(context, 'Quality Gate Engine');
    const finalProject = await QualityGateEngine.evaluateAndImprove(parsedProject, {
      aiExecutor: options.aiExecutor,
      onStepProgress: options.onStepProgress,
    });

    finalProject.requirements = context.requirements;
    finalProject.architecture = context.architecturePlan;
    finalProject.securityPlan = context.securityPlan;

    options.onStepProgress?.('Project Ready.');
    EngineeringCoreLogger.finalizeLog(context);
    return finalProject;
  }
}
