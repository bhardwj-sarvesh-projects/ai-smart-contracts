import { ArchitecturePlan, ProjectRequirements, FileCategory, ClassifiedFilePlan, ProjectProfile } from '../types';
import { CategoryClassifier } from '../validators/CategoryClassifier';
import { CompilerType } from '../compiler/CompilerEngine';

export class ArchitecturePlanner {
  static classifyFile(path: string): FileCategory {
    return CategoryClassifier.classify(path);
  }

  /**
   * Sole Source of Truth for ProjectProfile creation.
   * Deterministically resolves Blockchain + Language + Framework into an immutable ProjectProfile.
   */
  static createProfile(req: ProjectRequirements, projectId?: string): ProjectProfile {
    const rawChain = (req.blockchain || 'ethereum').toLowerCase();
    const rawLang = (req.language || '').toLowerCase();
    const rawFw = (req.framework || '').toLowerCase();

    let blockchain = rawChain;
    let language = rawLang;
    let framework = rawFw;
    let compiler: CompilerType = 'forge';
    let validator = 'SolidityValidator';
    let workspaceTemplate = 'FoundryTemplate';
    let packageManager = 'forge';
    let deploymentTarget = 'Testnet / Mainnet RPC';
    let testingFramework = 'Foundry Test (.t.sol)';
    let documentationStrategy = 'Enterprise Markdown Suite';
    let exportStrategy = 'SHA256 Checksum Manifest';

    const evmChains = ['ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche'];
    const isEVM = evmChains.includes(rawChain);

    if (isEVM) {
      blockchain = rawChain;
      language = 'solidity';
      if (!rawFw || rawFw === 'foundry' || rawFw === 'forge') {
        framework = 'foundry';
        compiler = 'forge';
        validator = 'SolidityValidator';
        workspaceTemplate = 'FoundryTemplate';
        packageManager = 'forge';
        testingFramework = 'Foundry Test (.t.sol)';
      } else if (rawFw === 'hardhat') {
        framework = 'hardhat';
        compiler = 'hardhat';
        validator = 'SolidityValidator';
        workspaceTemplate = 'HardhatTemplate';
        packageManager = 'npm';
        testingFramework = 'Hardhat Mocha / Chai (.test.ts)';
      } else {
        throw new Error(`UNSUPPORTED_PROJECT_PROFILE: Combination (Blockchain="${rawChain}", Language="${rawLang}", Framework="${rawFw}") is unsupported.`);
      }
    } else if (rawChain === 'solana') {
      blockchain = 'solana';
      if (rawLang === 'solidity' || rawFw === 'solang') {
        language = 'solidity';
        framework = 'solang';
        compiler = 'solang';
        validator = 'SolidityValidator';
        workspaceTemplate = 'SolangTemplate';
        packageManager = 'npm';
        testingFramework = 'Solang Mocha TS Client (.ts)';
      } else if (rawLang === 'rust' || rawFw === 'anchor' || !rawLang) {
        language = 'rust';
        framework = 'anchor';
        compiler = 'anchor';
        validator = 'RustValidator';
        workspaceTemplate = 'AnchorTemplate';
        packageManager = 'cargo';
        testingFramework = 'Anchor TS Client (.ts)';
      } else {
        throw new Error(`UNSUPPORTED_PROJECT_PROFILE: Combination (Blockchain="solana", Language="${rawLang}", Framework="${rawFw}") is unsupported.`);
      }
    } else if (rawChain === 'aptos') {
      blockchain = 'aptos';
      if (rawLang && rawLang !== 'move') {
        throw new Error(`UNSUPPORTED_PROJECT_PROFILE: Combination (Blockchain="aptos", Language="${rawLang}", Framework="${rawFw}") is unsupported.`);
      }
      language = 'move';
      framework = 'aptos-framework';
      compiler = 'aptos-move';
      validator = 'MoveValidator';
      workspaceTemplate = 'AptosTemplate';
      packageManager = 'move';
      testingFramework = 'Aptos Move Unit Test (.move)';
    } else if (rawChain === 'sui') {
      blockchain = 'sui';
      if (rawLang && rawLang !== 'move') {
        throw new Error(`UNSUPPORTED_PROJECT_PROFILE: Combination (Blockchain="sui", Language="${rawLang}", Framework="${rawFw}") is unsupported.`);
      }
      language = 'move';
      framework = 'sui-framework';
      compiler = 'sui-move';
      validator = 'MoveValidator';
      workspaceTemplate = 'SuiTemplate';
      packageManager = 'move';
      testingFramework = 'Sui Move Unit Test (.move)';
    } else if (rawChain === 'cosmos') {
      blockchain = 'cosmos';
      language = 'rust';
      framework = 'cosmwasm';
      compiler = 'cargo-build';
      validator = 'RustValidator';
      workspaceTemplate = 'CosmWasmTemplate';
      packageManager = 'cargo';
      testingFramework = 'CosmWasm Integration Test (.rs)';
    } else if (rawChain === 'hyperledger') {
      blockchain = 'hyperledger';
      language = rawLang === 'go' ? 'go' : 'typescript';
      framework = 'fabric';
      compiler = 'generic';
      validator = 'TypeScriptValidator';
      workspaceTemplate = 'FabricTemplate';
      packageManager = 'npm';
      testingFramework = 'Fabric Chaincode Test';
    } else if (rawChain === 'starknet' || rawLang === 'cairo') {
      blockchain = 'starknet';
      language = 'cairo';
      framework = 'scarb';
      compiler = 'generic';
      validator = 'CairoValidator';
      workspaceTemplate = 'ScarbTemplate';
      packageManager = 'scarb';
      testingFramework = 'Starknet Forge Test';
    } else {
      throw new Error(`UNSUPPORTED_PROJECT_PROFILE: Combination (Blockchain="${rawChain}", Language="${rawLang}", Framework="${rawFw}") is unsupported.`);
    }

    const rawContractType = req.contractType || 'SmartContract';
    const cleanPascal = rawContractType.replace(/[^a-zA-Z0-9]/g, '');
    const pNamePascal = cleanPascal ? cleanPascal.charAt(0).toUpperCase() + cleanPascal.slice(1) : 'SmartContract';
    const pName = pNamePascal.toLowerCase();

    let directoryLayout: string[] = [];

    switch (workspaceTemplate) {
      case 'FoundryTemplate':
        directoryLayout = [
          `contracts/${pNamePascal}.sol`,
          `interfaces/I${pNamePascal}.sol`,
          `libraries/${pNamePascal}Lib.sol`,
          `scripts/deploy.ts`,
          `test/${pNamePascal}.t.sol`,
          'foundry.toml',
          'package.json',
          '.env.example',
          'README.md',
          'ARCHITECTURE.md',
          'SECURITY.md',
          'DEPLOYMENT.md'
        ];
        break;
      case 'HardhatTemplate':
        directoryLayout = [
          `contracts/${pNamePascal}.sol`,
          `interfaces/I${pNamePascal}.sol`,
          `libraries/${pNamePascal}Lib.sol`,
          `scripts/deploy.ts`,
          `test/${pNamePascal}.test.ts`,
          'hardhat.config.ts',
          'package.json',
          'tsconfig.json',
          '.env.example',
          'README.md',
          'ARCHITECTURE.md',
          'SECURITY.md',
          'DEPLOYMENT.md'
        ];
        break;
      case 'SolangTemplate':
        directoryLayout = [
          `contracts/${pNamePascal}.sol`,
          'tests/solang-test.ts',
          'scripts/deploy.ts',
          'solang.toml',
          'package.json',
          'tsconfig.json',
          'README.md',
          'SECURITY.md',
          'DEPLOYMENT.md'
        ];
        break;
      case 'AnchorTemplate':
        directoryLayout = [
          `programs/${pName}/src/lib.rs`,
          'tests/anchor-test.ts',
          'migrations/deploy.ts',
          'app/index.html',
          'Anchor.toml',
          'Cargo.toml',
          'package.json',
          'tsconfig.json',
          'README.md',
          'SECURITY.md',
          'DEPLOYMENT.md',
          'BUILD_INSTRUCTIONS.md'
        ];
        break;
      case 'AptosTemplate':
      case 'SuiTemplate':
        directoryLayout = [
          'Move.toml',
          `sources/${pName}.move`,
          'tests/move_test.move',
          'scripts/run.move',
          'README.md'
        ];
        break;
      case 'CosmWasmTemplate':
        directoryLayout = [
          `contracts/${pName}/src/contract.rs`,
          `contracts/${pName}/src/msg.rs`,
          `contracts/${pName}/src/state.rs`,
          'schema/schema.json',
          'tests/integration_tests.rs',
          'Cargo.toml',
          'README.md'
        ];
        break;
      case 'FabricTemplate':
        directoryLayout = [
          `chaincode/${pName}/contract.ts`,
          'network/docker-compose.yaml',
          'config/connection.json',
          'README.md'
        ];
        break;
      case 'ScarbTemplate':
        directoryLayout = [
          'src/lib.cairo',
          `src/${pName}.cairo`,
          'Scarb.toml',
          'README.md'
        ];
        break;
      default:
        directoryLayout = [
          `contracts/${pNamePascal}.sol`,
          'package.json',
          'README.md'
        ];
        break;
    }

    const profile: ProjectProfile = {
      projectId: projectId || `proj-${Date.now()}`,
      blockchain,
      language,
      framework,
      compiler,
      validator,
      workspaceTemplate,
      directoryLayout,
      packageManager,
      deploymentTarget,
      testingFramework,
      documentationStrategy,
      exportStrategy,
      contractType: req.contractType || 'Smart Contract',
      createdAt: new Date().toISOString()
    };

    return Object.freeze(profile);
  }

  /**
   * Fail-Fast Validation Rule:
   * Rejects any file path that violates the immutable ProjectProfile.
   */
  static validateProfileFileMismatch(profile: ProjectProfile, filePath: string): void {
    const normPath = filePath.replace(/\\/g, '/');
    const lower = normPath.toLowerCase();

    if (profile.workspaceTemplate === 'SolangTemplate' || profile.framework === 'solang') {
      if (lower.includes('programs/') || lower.includes('lib.rs') || lower.includes('anchor.toml') || lower.endsWith('.rs')) {
        throw new Error(`PROJECT_PROFILE_MISMATCH: Generated file "${filePath}" violates ProjectProfile (Blockchain: "${profile.blockchain}", Language: "${profile.language}", Framework: "${profile.framework}")`);
      }
    } else if (profile.workspaceTemplate === 'AnchorTemplate' || profile.framework === 'anchor') {
      if (lower.includes('contracts/') || lower.endsWith('.sol')) {
        throw new Error(`PROJECT_PROFILE_MISMATCH: Generated file "${filePath}" violates ProjectProfile (Blockchain: "${profile.blockchain}", Language: "${profile.language}", Framework: "${profile.framework}")`);
      }
    } else if (['ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche'].includes(profile.blockchain)) {
      if (
        lower.includes('programs/') ||
        lower.includes('lib.rs') ||
        lower.includes('anchor.toml') ||
        lower.includes('solang.toml') ||
        lower.includes('cargo.toml') ||
        lower.includes('cargo.lock') ||
        lower.includes('move.toml') ||
        lower.includes('sources/') ||
        lower.includes('scarb.toml') ||
        lower.endsWith('.rs') ||
        lower.endsWith('.move') ||
        lower.endsWith('.cairo')
      ) {
        throw new Error(`PROJECT_PROFILE_MISMATCH: Generated file "${filePath}" violates ProjectProfile (Blockchain: "${profile.blockchain}", Language: "${profile.language}", Framework: "${profile.framework}")`);
      }
    }
  }

  static plan(req: ProjectRequirements | ProjectProfile): { profile: ProjectProfile; architecturePlan: ArchitecturePlan } {
    let profile: ProjectProfile;

    if ('workspaceTemplate' in req && 'directoryLayout' in req) {
      profile = req as ProjectProfile;
    } else {
      profile = ArchitecturePlanner.createProfile(req as ProjectRequirements);
    }

    const folderStructure = [...profile.directoryLayout];
    const pName = profile.contractType ? profile.contractType.toLowerCase().replace(/\s+/g, '_') : 'my_contract';
    const pNamePascal = profile.contractType ? profile.contractType.replace(/\s+/g, '') : 'MyContract';

    let contracts: Array<{ name: string; type: string; purpose: string }> = [];
    let interfaces: Array<{ name: string; purpose: string }> = [];
    let libraries: Array<{ name: string; purpose: string }> = [];
    let storageLayout = '';
    let modules: string[] = [];
    let dependencies: string[] = [];

    if (profile.workspaceTemplate === 'AnchorTemplate') {
      contracts = [{ name: `programs/${pName}/src/lib.rs`, type: 'Program', purpose: 'Core Solana Anchor program entrypoint' }];
      interfaces = [];
      libraries = [{ name: `programs/${pName}/src/state.rs`, purpose: 'Account state definitions' }];
      storageLayout = 'Anchor Account structs with 8-byte discriminator padding';
      modules = ['instructions', 'state', 'errors'];
      dependencies = ['anchor-lang', 'anchor-spl'];
    } else if (profile.workspaceTemplate === 'SolangTemplate') {
      contracts = [{ name: `contracts/${pNamePascal}.sol`, type: 'Solang Contract', purpose: 'Solana Solidity smart contract compiled via Solang' }];
      interfaces = [];
      libraries = [];
      storageLayout = 'Solang storage layout mapped to Solana accounts';
      modules = ['contracts', 'tests', 'scripts'];
      dependencies = ['@solana/web3.js', '@hyperledger/solang'];
    } else if (profile.workspaceTemplate === 'AptosTemplate' || profile.workspaceTemplate === 'SuiTemplate') {
      contracts = [{ name: `sources/${pName}.move`, type: 'Module', purpose: 'Move asset management module' }];
      interfaces = [];
      libraries = [];
      storageLayout = 'Resource Capability Model & Global Storage';
      modules = ['core', 'types'];
      dependencies = profile.workspaceTemplate === 'AptosTemplate' ? ['AptosFramework'] : ['Sui'];
    } else if (profile.workspaceTemplate === 'CosmWasmTemplate') {
      contracts = [{ name: `contracts/${pName}/src/contract.rs`, type: 'CosmWasm Contract', purpose: 'CosmWasm CosmJS execution flow' }];
      interfaces = [];
      libraries = [];
      storageLayout = 'CosmWasm Singleton / Map state Storage';
      modules = ['msg', 'state', 'contract'];
      dependencies = ['cosmwasm-std', 'cw-storage-plus'];
    } else if (profile.workspaceTemplate === 'FabricTemplate') {
      contracts = [{ name: `chaincode/${pName}/contract.ts`, type: 'Chaincode', purpose: 'Hyperledger Fabric Chaincode contract API' }];
      interfaces = [];
      libraries = [];
      storageLayout = 'State database ledger key-value mapping (CouchDB / LevelDB)';
      modules = ['chaincode', 'network', 'config'];
      dependencies = ['fabric-contract-api', 'fabric-shim'];
    } else if (profile.workspaceTemplate === 'ScarbTemplate') {
      contracts = [{ name: `src/${pName}.cairo`, type: 'Starknet Contract', purpose: 'Starknet Cairo 2 protocol module' }];
      interfaces = [{ name: 'src/interface.cairo', purpose: 'Contract interface trait' }];
      libraries = [];
      storageLayout = 'Starknet Storage Struct';
      modules = ['contract', 'interface'];
      dependencies = ['openzeppelin_cairo_contracts'];
    } else {
      contracts = [{ name: `contracts/${pNamePascal}.sol`, type: 'Core Implementation', purpose: 'Main enterprise business logic' }];
      interfaces = [{ name: `interfaces/I${pNamePascal}.sol`, purpose: 'Full contract external interface & custom errors' }];
      libraries = [{ name: `libraries/${pNamePascal}Lib.sol`, purpose: 'Custom errors & helper signatures' }];
      storageLayout = 'Packed slots (uint96 + address, bool flags)';
      modules = ['contracts', 'interfaces', 'libraries', 'scripts', 'test'];
      dependencies = ['@openzeppelin/contracts'];
    }

    const classifiedFiles: ClassifiedFilePlan[] = folderStructure.map(p => ({
      path: p,
      category: ArchitecturePlanner.classifyFile(p)
    }));

    return {
      profile,
      architecturePlan: {
        folderStructure,
        classifiedFiles,
        contracts,
        interfaces,
        libraries,
        storageLayout,
        modules,
        dependencies
      }
    };
  }
}
