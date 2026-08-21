import { UniversalPipeline, PipelineExecutionOptions } from './UniversalPipeline';
import { StructuredProjectOutput } from '../types';
// CompilerEngine/SecurityAuditEngine/DeploymentEngine are still used below by
// the standalone compile()/audit()/deploy() helpers (currently not wired to
// any UI component). The main generate() pipeline no longer calls any
// Node-dependent EngineeringCore engine directly -- see /api/pipeline/certify
// in server.ts for where that logic now lives.
import { CompilerEngine } from '../compiler/CompilerEngine';
import { SecurityAuditEngine } from '../security/SecurityAuditEngine';
import { DeploymentEngine, WalletConfig, NetworkConfig } from '../deployment/DeploymentEngine';
import { ProjectIntegrityEngine } from '../validators/ProjectIntegrityEngine';
import { ProjectFile } from '../../../types';
import { ResponseClassifier } from '../parsers/ResponseClassifier';
import { ResponseParser } from '../parsers/ResponseParser';
import { BackgroundTaskManager } from '../services/BackgroundTaskManager';

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

      // 4-12. Real Compilation -> Testing -> Security Audit -> Dependency
      // Validation -> Architecture Validation -> Documentation -> Deployment
      // Pre-Checks -> Export Certification -> Engineering Certification Gate.
      //
      // This entire chain now runs server-side via /api/pipeline/certify
      // instead of calling CompilerEngine/TestingValidationEngine/etc.
      // directly from here. Those two engines invoke Node's
      // fs/path/os/child_process/crypto to spawn real compiler/test binaries
      // and hash workspace evidence -- APIs that do not exist in a browser
      // tab. AuthoritativePipelineRouter executes in the browser (it is
      // reached via App.tsx -> GenerationService -> EngineeringCore), so
      // calling those engines locally could only ever produce NOT_VERIFIED
      // evidence at best, or a runtime crash at worst. The server process
      // running server.ts is genuine Node, so /api/pipeline/certify is able
      // to produce REAL_EXECUTION evidence whenever compiler/test toolchains
      // are installed there.
      const blockchain = project.projectProfile?.blockchain || project.blockchain || options.blockchain || 'ethereum';
      const framework = project.projectProfile?.framework || project.framework || options.framework || 'foundry';
      const language = project.projectProfile?.language || project.language || options.language || 'solidity';

      if (!options.authedFetch) {
        if (typeof process !== 'undefined' && process.versions?.node) {
          const compileRes = CompilerEngine.certifyCompilation(
            currentFiles,
            project.name || 'SmartContractProject',
            blockchain,
            framework,
          );
          if (!compileRes.result.success && compileRes.result.status === 'FAIL') {
            throw new Error(JSON.stringify({
              stage: 'Compilation',
              engine: 'CompilerEngine',
              errorCode: 'COMPILATION_FAILED',
              message: compileRes.result.stderr || 'Compilation failed',
              command: compileRes.result.command || '',
              retryable: false,
            }));
          }
          project.files = currentFiles;
          return project;
        }

        throw new Error(JSON.stringify({
          stage: 'Certification',
          engine: 'AuthoritativePipelineRouter',
          file: 'AuthoritativePipelineRouter.ts',
          errorCode: 'MISSING_AUTHED_FETCH',
          message: 'options.authedFetch is required to reach /api/pipeline/certify.',
          retryable: false
        }));
      }

      const certifyRes = await options.authedFetch('/api/pipeline/certify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: currentFiles,
          projectName: project.name || 'SmartContractProject',
          userPrompt: options.userPrompt,
          blockchain,
          framework,
          language
        })
      });

      if (!certifyRes.ok) {
        const text = await certifyRes.text();
        let errData: any;
        try { errData = JSON.parse(text); } catch {
          errData = {
            stage: 'Certification',
            engine: 'PipelineCertifyRoute',
            errorCode: 'CERTIFY_API_ERROR',
            message: text || 'Server-side certification request failed.',
            retryable: false
          };
        }
        throw new Error(JSON.stringify(errData));
      }

      const certifyPayload = await certifyRes.json();
      if (!certifyPayload.success) {
        // The server already distinguishes real FAIL from NOT_VERIFIED the
        // same way this router used to -- see /api/pipeline/certify in
        // server.ts. It only returns success:false for a genuine defect
        // (real compile/test failure) or a real certification-gate failure.
        throw new Error(JSON.stringify(certifyPayload));
      }

      project.files = certifyPayload.files;
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
