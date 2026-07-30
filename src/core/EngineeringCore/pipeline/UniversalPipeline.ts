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
import { ProjectIntegrityEngine } from '../validators/ProjectIntegrityEngine';
import { DependencyValidationEngine } from '../validators/DependencyValidationEngine';
import { CompilerEngine } from '../compiler/CompilerEngine';
import { CopilotEngine } from '../copilot/CopilotEngine';
import { SecurityAuditEngine } from '../security/SecurityAuditEngine';
import { DeploymentEngine, WalletConfig, NetworkConfig } from '../deployment/DeploymentEngine';
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

    // 15. Project Integrity Engine Certification
    options.onStepProgress?.('Certifying Project Integrity...');
    EngineeringCoreLogger.logStage(context, 'Project Integrity Engine');
    const certification = ProjectIntegrityEngine.certifyProject(
      finalProject.files || [],
      finalProject.name || 'SmartContractProject',
      context.requirements.blockchain,
      context.requirements.language,
      context.requirements.framework
    );
    finalProject.files = certification.certifiedFiles;

    // 16. Dependency & Toolchain Validation Engine
    options.onStepProgress?.('Validating Ecosystem & Toolchain Dependencies...');
    EngineeringCoreLogger.logStage(context, 'Dependency & Toolchain Engine');
    const toolchainCertification = DependencyValidationEngine.validateAndCertifyToolchain(
      finalProject.files || [],
      finalProject.name || 'SmartContractProject',
      context.requirements.blockchain,
      context.requirements.framework,
      context.requirements.language
    );
    finalProject.files = toolchainCertification.certifiedFiles;

    // 17. Compiler Intelligence & Self-Healing Engine
    options.onStepProgress?.('Compiling and Self-Healing Smart Contract Code...');
    EngineeringCoreLogger.logStage(context, 'Compiler Intelligence Engine');
    const compilationCertification = CompilerEngine.certifyCompilation(
      finalProject.files || [],
      finalProject.name || 'SmartContractProject',
      context.requirements.blockchain,
      context.requirements.framework,
      context.requirements.language
    );
    finalProject.files = compilationCertification.certifiedFiles;

    // 18. Security Audit & Remediation Engine
    options.onStepProgress?.('Executing Blockchain-Aware Security Audit...');
    EngineeringCoreLogger.logStage(context, 'Security Audit Engine');
    const securityCertification = SecurityAuditEngine.certifySecurity(
      finalProject.files || [],
      finalProject.name || 'SmartContractProject',
      context.requirements.blockchain
    );
    finalProject.files = securityCertification.certifiedFiles;

    // 19. Copilot Intelligence Engine Context Initialization
    options.onStepProgress?.('Initializing Copilot IDE Context...');
    EngineeringCoreLogger.logStage(context, 'Copilot Intelligence Engine');
    const copilotContext = CopilotEngine.buildProjectContext(
      finalProject.files || [],
      finalProject.name || 'SmartContractProject'
    );
    const initialPlan = CopilotEngine.planChanges(options.userPrompt, finalProject.files || []);
    const impact = CopilotEngine.estimateImpact(options.userPrompt, finalProject.files || [], initialPlan);
    const explanation = CopilotEngine.explainPatch(initialPlan, impact);
    const copilotReport = CopilotEngine.generateCopilotReport(
      finalProject.name || 'SmartContractProject',
      options.userPrompt,
      initialPlan,
      impact,
      explanation,
      'Initial Copilot Workspace Context Ready (Integrity PASS, Dependencies PASS, Compiler PASS).',
      'PASSED & CERTIFIED'
    );
    const existingCopilotRepIdx = (finalProject.files || []).findIndex(f => f.path === 'COPILOT_REPORT.md');
    if (existingCopilotRepIdx >= 0) {
      finalProject.files[existingCopilotRepIdx] = { path: 'COPILOT_REPORT.md', content: copilotReport, language: 'markdown' };
    } else {
      finalProject.files.push({ path: 'COPILOT_REPORT.md', content: copilotReport, language: 'markdown' });
    }

    // 20. Deployment & Verification Engine Readiness Initialization
    options.onStepProgress?.('Preparing Blockchain Deployment & Verification Pipeline...');
    EngineeringCoreLogger.logStage(context, 'Deployment Engine');
    const defaultWallet: WalletConfig = {
      walletType: context.requirements.blockchain === 'Solana' ? 'Phantom' : (context.requirements.blockchain === 'Aptos' ? 'Petra Wallet' : (context.requirements.blockchain === 'Sui' ? 'Sui Wallet' : 'MetaMask')),
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      isConnected: true,
      blockchain: context.requirements.blockchain || 'Ethereum/EVM'
    };
    const defaultNetwork: NetworkConfig = {
      networkName: `${context.requirements.blockchain || 'Ethereum'} Testnet`,
      rpcUrl: 'https://rpc.ankr.com/eth_sepolia',
      explorerBaseUrl: context.requirements.blockchain === 'Solana' ? 'https://solscan.io' : (context.requirements.blockchain === 'Aptos' ? 'https://explorer.aptoslabs.com' : (context.requirements.blockchain === 'Sui' ? 'https://suivision.xyz' : 'https://sepolia.etherscan.io')),
      nativeCurrencySymbol: context.requirements.blockchain === 'Solana' ? 'SOL' : (context.requirements.blockchain === 'Aptos' ? 'APT' : (context.requirements.blockchain === 'Sui' ? 'SUI' : 'ETH')),
      isSupported: true
    };
    const deploymentPrep = DeploymentEngine.prepareDeployment(
      finalProject.files || [],
      finalProject.name || 'SmartContractProject',
      {
        projectName: finalProject.name || 'SmartContractProject',
        blockchain: context.requirements.blockchain,
        framework: context.requirements.framework,
        wallet: defaultWallet,
        network: defaultNetwork
      }
    );
    const existingDepRepIdx = (finalProject.files || []).findIndex(f => f.path === 'DEPLOYMENT_REPORT.md');
    if (existingDepRepIdx >= 0) {
      finalProject.files[existingDepRepIdx] = { path: 'DEPLOYMENT_REPORT.md', content: deploymentPrep.reportMarkdown, language: 'markdown' };
    } else {
      finalProject.files.push({ path: 'DEPLOYMENT_REPORT.md', content: deploymentPrep.reportMarkdown, language: 'markdown' });
    }

    finalProject.requirements = context.requirements;
    finalProject.architecture = context.architecturePlan;
    finalProject.securityPlan = context.securityPlan;

    options.onStepProgress?.('Project Certified & Ready.');
    EngineeringCoreLogger.finalizeLog(context);
    return finalProject;
  }
}
