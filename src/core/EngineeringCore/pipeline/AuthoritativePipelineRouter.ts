import { UniversalPipeline, PipelineExecutionOptions } from './UniversalPipeline';
import { StructuredProjectOutput } from '../types';
import { CompilerEngine } from '../compiler/CompilerEngine';
import { SecurityAuditEngine } from '../security/SecurityAuditEngine';
import { DeploymentEngine, WalletConfig, NetworkConfig } from '../deployment/DeploymentEngine';
import { ProjectIntegrityEngine } from '../validators/ProjectIntegrityEngine';
import { EngineeringCertificationEngine } from '../certification/EngineeringCertificationEngine';
import { ProjectFile } from '../../../types';
import { ResponseClassifier } from '../parsers/ResponseClassifier';
import { ResponseParser } from '../parsers/ResponseParser';
import { BackgroundTaskManager } from '../services/BackgroundTaskManager';
import { TestingValidationEngine } from '../testing/TestingValidationEngine';
import { DependencyValidationEngine } from '../validators/DependencyValidationEngine';
import { ArchitectureValidationEngine } from '../architecture/ArchitectureValidationEngine';
import { DocumentationEngine } from '../documentation/DocumentationEngine';
import { ExportEngine } from '../export/ExportEngine';

export class AuthoritativePipelineRouter {
  public static async generate(options: PipelineExecutionOptions): Promise<StructuredProjectOutput> {
    if (!options.userPrompt || !options.userPrompt.trim()) {
      throw new Error(JSON.stringify({
        stage: 'Generation',
        engine: 'AuthoritativePipelineRouter',
        file: 'AuthoritativePipelineRouter.ts',
        errorCode: 'INVALID_PIPELINE_REQUEST',
        message: 'userPrompt is required.',
        retryable: false,
        attempt: 1
      }));
    }

    try {
      options.onStepProgress?.('Executing generation pipeline...');

      // 1. Requirements -> Profile -> Architecture -> Manifest -> Generation
      const project = await UniversalPipeline.execute(options);

      // Nuke background tasks to enforce deterministic synchronous execution
      BackgroundTaskManager.getInstance().clearAll();

      // 2. Response Classification & Validation
      const currentFiles: ProjectFile[] = [];
      for (const file of project.files || []) {
        const category = ResponseClassifier.classify(file.content, file.path);

        if (
          category === 'PROVIDER_ERROR' ||
          category === 'RATE_LIMIT_ERROR' ||
          category === 'CONTEXT_TOKEN_ERROR' ||
          category === 'EMPTY_RESPONSE'
        ) {
          throw new Error(JSON.stringify({
            stage: 'Generation',
            engine: 'ResponseClassifier',
            file: file.path,
            errorCode: 'INVALID_AI_RESPONSE',
            message: `Invalid AI response state (${category}) for file: ${file.path}`,
            retryable: false
          }));
        }

        if (category === 'STRUCTURED_JSON_METADATA') {
          throw new Error(JSON.stringify({
            stage: 'Generation',
            engine: 'ResponseClassifier',
            file: file.path,
            errorCode: 'JSON_LEAKAGE',
            message: `JSON metadata leaked into source file ${file.path}. Generation aborted.`,
            retryable: false
          }));
        }

        let cleanContent = file.content;
        if (category === 'MARKDOWN_WRAPPED_SOURCE') {
          cleanContent = ResponseParser.extractSource(cleanContent, file.path);
        }

        // Enforce Ecosystem Consistency Rule
        if (project.projectProfile?.blockchain === 'Ethereum' || project.projectProfile?.blockchain?.includes('EVM')) {
          if (cleanContent.includes('solang.toml') || cleanContent.includes('Anchor.toml') || file.path.includes('Anchor.toml')) {
            throw new Error(JSON.stringify({
              stage: 'Generation',
              engine: 'AuthoritativePipelineRouter',
              file: file.path,
              errorCode: 'ECOSYSTEM_CONSISTENCY_ERROR',
              message: `Solana settings bleed into EVM repository in ${file.path}`,
              retryable: false
            }));
          }
        }

        currentFiles.push({ ...file, content: cleanContent });
      }

      // 3. Workspace Integrity Validation
      const integrityResult = ProjectIntegrityEngine.validateWorkspaceIntegrity(currentFiles, project.projectProfile);
      if (!integrityResult.isValid) {
        throw new Error(JSON.stringify({
          stage: 'Validation',
          engine: 'ProjectIntegrityEngine',
          file: 'ProjectIntegrityEngine.ts',
          errorCode: 'WORKSPACE_INTEGRITY_FAILED',
          message: integrityResult.errors.join(', '),
          retryable: false
        }));
      }

      // 4. Real Compilation
      const compResult = CompilerEngine.certifyCompilation(
        currentFiles,
        project.name || 'SmartContractProject',
        project.blockchain,
        project.framework,
        project.language
      );
      if (!compResult.result.success) {
        throw new Error(JSON.stringify({
          stage: 'Compilation',
          engine: 'CompilerEngine',
          file: 'CompilerEngine.ts',
          errorCode: 'COMPILATION_FAILED',
          message: 'Compiler errors detected during build.',
          retryable: false,
          command: compResult.result.command || 'UNKNOWN',
          exitCode: compResult.result.exitCode ?? 'UNKNOWN',
          stdout: compResult.result.stdout || compResult.result.reportMarkdown || '',
          stderr: compResult.result.stderr || '',
          verificationMode: compResult.result.verificationMode || 'UNKNOWN',
          compilerVersion: compResult.result.compilerVersion || 'UNKNOWN',
          durationMs: compResult.result.durationMs ?? null
        }));
      }
      let certifiedFiles = compResult.certifiedFiles;

      // 5. Real Test Execution
      const testResult = TestingValidationEngine.certifyTesting(
        certifiedFiles,
        project.name || 'SmartContractProject',
        options.userPrompt,
        project.blockchain
      );
      if (!testResult.testingPassed) {
        throw new Error(JSON.stringify({
          stage: 'Testing',
          engine: 'TestingValidationEngine',
          file: 'TestingValidationEngine.ts',
          errorCode: 'TESTING_FAILED',
          message: `Framework test binary run failed with exit status ${testResult.exitStatus}.`,
          retryable: false,
          command: testResult.evidence.command,
          exitCode: testResult.exitStatus,
          stdout: testResult.stdout,
          stderr: testResult.stderr
        }));
      }

      // 6. Security Audit
      const auditResult = SecurityAuditEngine.certifySecurity(
        certifiedFiles,
        project.name || 'SmartContractProject',
        project.blockchain,
        { success: compResult.result.success, status: compResult.result.status, verificationMode: compResult.result.verificationMode, exitCode: compResult.result.exitCode }
      );
      certifiedFiles = auditResult.certifiedFiles;

      // 7. Dependency Validation
      const depResult = DependencyValidationEngine.validateAndCertifyToolchain(
        certifiedFiles,
        project.name || 'SmartContractProject',
        project.blockchain,
        project.framework,
        project.language
      );
      certifiedFiles = depResult.certifiedFiles;

      // 8. Architecture Validation
      const archResult = ArchitectureValidationEngine.certifyArchitecture(
        certifiedFiles,
        project.name || 'SmartContractProject',
        options.userPrompt,
        project.blockchain || 'Ethereum'
      );
      certifiedFiles = archResult.certifiedFiles;

      // 9. Documentation
      const docResult = DocumentationEngine.certifyDocumentation(
        certifiedFiles,
        project.name || 'SmartContractProject',
        options.userPrompt,
        project.blockchain || 'Ethereum'
      );
      certifiedFiles = docResult.certifiedFiles;

      // 10. Deployment Pre-Checks
      const deployResult = DeploymentEngine.runPreChecks(
        certifiedFiles,
        {
          projectName: project.name || 'SmartContractProject',
          blockchain: project.blockchain || 'Ethereum',
          framework: project.framework,
          wallet: { walletType: 'browser', isConnected: false, blockchain: project.blockchain || 'Ethereum', address: '0x0000000000000000000000000000000000000000' },
          network: { networkName: 'mainnet', rpcUrl: '', explorerBaseUrl: '', nativeCurrencySymbol: 'ETH', isSupported: true }
        }
      );

      // Route diagnostics to hidden folder (.diagnostics/)
      const diagnosticsFiles: ProjectFile[] = [];
      const clientFiles: ProjectFile[] = [];
      for (const file of certifiedFiles) {
        if (file.path.endsWith('_REPORT.md') || file.path.includes('REPORT') ||
            file.path === 'COMPILATION_REPORT.md' || file.path === 'SECURITY_AUDIT_REPORT.md') {
          diagnosticsFiles.push({ ...file, path: '.diagnostics/' + file.path.split('/').pop() });
        } else {
          clientFiles.push(file);
        }
      }

      // 11. Export Certification
      const exportResult = ExportEngine.certifyExport(
        clientFiles,
        project.name || 'SmartContractProject',
        options.userPrompt,
        project.blockchain || 'Ethereum',
        project.framework || 'Foundry'
      );

      // 12. Engineering Certification Gate (Pure Evidence Consumer)
      const certification = EngineeringCertificationEngine.certifyProject(
        clientFiles,
        project.name || 'SmartContractProject',
        options.userPrompt,
        project.blockchain || 'Ethereum',
        {
          projectId: project.projectProfile?.projectId,
          framework: project.framework,
          language: project.language,
          compilationResult: compResult.result,
          testingResult: testResult,
          securityAuditResult: auditResult.auditResult,
          dependencyResult: depResult.result,
          architectureResult: archResult,
          documentationResult: docResult,
          deploymentResult: deployResult,
          exportResult: exportResult
        }
      );
      if (!certification.isCertified) {
        throw new Error(JSON.stringify({
          stage: 'Certification',
          engine: 'EngineeringCertificationEngine',
          file: 'EngineeringCertificationEngine.ts',
          errorCode: 'CERTIFICATION_FAILED',
          message: certification.issues.join(', '),
          retryable: false
        }));
      }

      // 8. Export deliverable files + diagnostics
      // Update DELIVERY_SUMMARY.md with the actual certified state
      const dsIndex = certification.certifiedFiles.findIndex(f => f.path.toUpperCase() === 'DELIVERY_SUMMARY.MD');
      if (dsIndex >= 0) {
        const certifiedDS = ExportEngine.generateDeliverySummary(
          certification.certifiedFiles,
          project.name || 'SmartContractProject',
          project.blockchain || 'Ethereum',
          exportResult,
          true
        );
        certification.certifiedFiles[dsIndex] = {
          ...certification.certifiedFiles[dsIndex],
          content: certifiedDS
        };
      }

      project.files = [...certification.certifiedFiles, ...diagnosticsFiles];
      return project;
    } catch (err: any) {
      // Single authoritative error propagation
      throw err;
    }
  }

  public static async compile(project: StructuredProjectOutput): Promise<any> {
    return CompilerEngine.certifyCompilation(
      project.files || [],
      project.name || 'SmartContractProject',
      project.blockchain,
      project.framework,
      project.language
    );
  }

  public static async audit(project: StructuredProjectOutput): Promise<any> {
    const compilation = CompilerEngine.certifyCompilation(
      project.files || [],
      project.name || 'SmartContractProject',
      project.blockchain,
      project.framework,
      project.language
    );
    return SecurityAuditEngine.certifySecurity(
      compilation.certifiedFiles,
      project.name || 'SmartContractProject',
      project.blockchain,
      { success: compilation.result.success, status: compilation.result.status, verificationMode: compilation.result.verificationMode, exitCode: compilation.result.exitCode }
    );
  }

  public static async deploy(project: StructuredProjectOutput, wallet?: WalletConfig, network?: NetworkConfig): Promise<any> {
    const defaultWallet: WalletConfig = wallet || {
      walletType: 'MetaMask',
      address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
      isConnected: true,
      blockchain: project.blockchain || 'Ethereum/EVM'
    };

    const defaultNetwork: NetworkConfig = network || {
      networkName: `${project.blockchain || 'Ethereum'} Testnet`,
      rpcUrl: 'https://rpc.ankr.com/eth_sepolia',
      explorerBaseUrl: 'https://sepolia.etherscan.io',
      nativeCurrencySymbol: 'ETH',
      isSupported: true
    };

    return DeploymentEngine.prepareDeployment(
      project.files || [],
      project.name || 'SmartContractProject',
      {
        projectName: project.name || 'SmartContractProject',
        blockchain: project.blockchain,
        framework: project.framework,
        wallet: defaultWallet,
        network: defaultNetwork
      }
    );
  }
}
