import { ArchitecturePlan, ProjectRequirements } from '../types';

export class ArchitecturePlanner {
  static plan(req: ProjectRequirements): ArchitecturePlan {
    const chain = (req.blockchain || 'ethereum').toLowerCase();
    const isEVM = ['ethereum', 'polygon', 'base', 'arbitrum', 'optimism', 'bnb', 'avalanche'].includes(chain);
    const isSolana = chain === 'solana';
    const isAptos = chain === 'aptos';
    const isSui = chain === 'sui';
    const isCosmos = chain === 'cosmos';
    const isHyperledger = chain === 'hyperledger';
    const isCairo = chain === 'starknet' || req.language.toLowerCase() === 'cairo';

    const pName = req.contractType ? req.contractType.toLowerCase().replace(/\s+/g, '_') : 'my_contract';
    const pNamePascal = req.contractType ? req.contractType.replace(/\s+/g, '') : 'MyContract';

    if (isSolana) {
      return {
        folderStructure: [
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
        ],
        contracts: [{ name: `programs/${pName}/src/lib.rs`, type: 'Program', purpose: 'Core Solana Anchor program entrypoint' }],
        interfaces: [],
        libraries: [{ name: `programs/${pName}/src/state.rs`, purpose: 'Account state definitions' }],
        storageLayout: 'Anchor Account structs with 8-byte discriminator padding',
        modules: ['instructions', 'state', 'errors'],
        dependencies: ['anchor-lang', 'anchor-spl']
      };
    }

    if (isAptos) {
      return {
        folderStructure: [
          'Move.toml',
          `sources/${pName}.move`,
          'tests/move_test.move',
          'scripts/run.move',
          'README.md'
        ],
        contracts: [{ name: `sources/${pName}.move`, type: 'Module', purpose: 'Aptos Move asset management module' }],
        interfaces: [],
        libraries: [],
        storageLayout: 'Resource Capability Model & Global Storage',
        modules: ['core', 'types'],
        dependencies: ['AptosFramework']
      };
    }

    if (isSui) {
      return {
        folderStructure: [
          'Move.toml',
          `sources/${pName}.move`,
          'tests/move_test.move',
          'scripts/run.move',
          'README.md'
        ],
        contracts: [{ name: `sources/${pName}.move`, type: 'Module', purpose: 'Sui Move coin capability module' }],
        interfaces: [],
        libraries: [],
        storageLayout: 'Object Ownership Model & Global Storage',
        modules: ['core', 'types'],
        dependencies: ['Sui']
      };
    }

    if (isCosmos) {
      return {
        folderStructure: [
          `contracts/${pName}/src/contract.rs`,
          `contracts/${pName}/src/msg.rs`,
          `contracts/${pName}/src/state.rs`,
          'schema/schema.json',
          'tests/integration_tests.rs',
          'Cargo.toml',
          'README.md'
        ],
        contracts: [{ name: `contracts/${pName}/src/contract.rs`, type: 'CosmWasm Contract', purpose: 'CosmWasm CosmJS execution flow' }],
        interfaces: [],
        libraries: [],
        storageLayout: 'CosmWasm Singleton / Map state Storage',
        modules: ['msg', 'state', 'contract'],
        dependencies: ['cosmwasm-std', 'cw-storage-plus']
      };
    }

    if (isHyperledger) {
      return {
        folderStructure: [
          `chaincode/${pName}/contract.ts`,
          'network/docker-compose.yaml',
          'config/connection.json',
          'README.md'
        ],
        contracts: [{ name: `chaincode/${pName}/contract.ts`, type: 'Chaincode', purpose: 'Hyperledger Fabric Chaincode contract API' }],
        interfaces: [],
        libraries: [],
        storageLayout: 'State database ledger key-value mapping (CouchDB / LevelDB)',
        modules: ['chaincode', 'network', 'config'],
        dependencies: ['fabric-contract-api', 'fabric-shim']
      };
    }

    if (isCairo) {
      return {
        folderStructure: [
          `src/lib.cairo`,
          `src/${pName}.cairo`,
          'Scarb.toml',
          'README.md'
        ],
        contracts: [{ name: `src/${pName}.cairo`, type: 'Starknet Contract', purpose: 'Starknet Cairo 2 protocol module' }],
        interfaces: [{ name: 'src/interface.cairo', purpose: 'Contract interface trait' }],
        libraries: [],
        storageLayout: 'Starknet Storage Struct',
        modules: ['contract', 'interface'],
        dependencies: ['openzeppelin_cairo_contracts']
      };
    }

    // Default EVM / Solidity modular architecture (Ethereum, Polygon, Base, Arbitrum, Optimism, Avalanche, BNB)
    return {
      folderStructure: [
        `contracts/${pNamePascal}.sol`,
        `interfaces/I${pNamePascal}.sol`,
        `libraries/${pNamePascal}Lib.sol`,
        `scripts/deploy.ts`,
        `test/${pNamePascal}.t.sol`,
        'foundry.toml',
        'hardhat.config.ts',
        'package.json',
        '.env.example',
        'README.md',
        'ARCHITECTURE.md',
        'SECURITY.md',
        'DEPLOYMENT.md'
      ],
      contracts: [{ name: `contracts/${pNamePascal}.sol`, type: 'Core Implementation', purpose: 'Main enterprise business logic' }],
      interfaces: [{ name: `interfaces/I${pNamePascal}.sol`, purpose: 'Full contract external interface & custom errors' }],
      libraries: [{ name: `libraries/${pNamePascal}Lib.sol`, purpose: 'Custom errors & helper signatures' }],
      storageLayout: 'Packed slots (uint96 + address, bool flags)',
      modules: ['contracts', 'interfaces', 'libraries', 'scripts', 'test'],
      dependencies: ['@openzeppelin/contracts']
    };
  }
}
