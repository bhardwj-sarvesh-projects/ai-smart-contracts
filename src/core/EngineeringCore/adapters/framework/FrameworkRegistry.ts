export interface FrameworkAdapter {
  id: string;
  name: string;
  configFile: string;
  testRunner: string;
  deployTool: string;
  recommendedDependencies: string[];
}

export class FoundryFrameworkAdapter implements FrameworkAdapter {
  id = 'foundry';
  name = 'Foundry';
  configFile = 'foundry.toml';
  testRunner = 'forge test';
  deployTool = 'forge script';
  recommendedDependencies = ['forge-std', 'openzeppelin-contracts'];
}

export class HardhatFrameworkAdapter implements FrameworkAdapter {
  id = 'hardhat';
  name = 'Hardhat';
  configFile = 'hardhat.config.ts';
  testRunner = 'npx hardhat test';
  deployTool = 'npx hardhat run scripts/deploy.ts';
  recommendedDependencies = ['@nomicfoundation/hardhat-toolbox', '@openzeppelin/contracts'];
}

export class AnchorFrameworkAdapter implements FrameworkAdapter {
  id = 'anchor';
  name = 'Anchor';
  configFile = 'Anchor.toml';
  testRunner = 'anchor test';
  deployTool = 'anchor deploy';
  recommendedDependencies = ['@coral-xyz/anchor', '@solana/web3.js'];
}

export class AptosFrameworkAdapter implements FrameworkAdapter {
  id = 'aptos-framework';
  name = 'Aptos Framework';
  configFile = 'Move.toml';
  testRunner = 'aptos move test';
  deployTool = 'aptos move publish';
  recommendedDependencies = ['AptosFramework', 'AptosStdlib'];
}

export class SuiFrameworkAdapter implements FrameworkAdapter {
  id = 'sui-framework';
  name = 'Sui Framework';
  configFile = 'Move.toml';
  testRunner = 'sui move test';
  deployTool = 'sui client publish';
  recommendedDependencies = ['Sui', 'SuiSystem'];
}

export class ScarbFrameworkAdapter implements FrameworkAdapter {
  id = 'scarb';
  name = 'Scarb';
  configFile = 'Scarb.toml';
  testRunner = 'snforge test / scarb test';
  deployTool = 'starkli declare & deploy';
  recommendedDependencies = ['openzeppelin_cairo_contracts', 'snforge_std'];
}

export class CosmWasmFrameworkAdapter implements FrameworkAdapter {
  id = 'cosmwasm';
  name = 'CosmWasm Framework';
  configFile = 'Cargo.toml';
  testRunner = 'cargo test';
  deployTool = 'wasmd tx wasm store';
  recommendedDependencies = ['cosmwasm-std', 'cw-storage-plus', 'cw-multi-test'];
}

export class HyperledgerSDKAdapter implements FrameworkAdapter {
  id = 'fabric-contract-api';
  name = 'Hyperledger Fabric Contract API';
  configFile = 'go.mod / package.json';
  testRunner = 'go test ./... / npm test';
  deployTool = 'peer lifecycle chaincode';
  recommendedDependencies = ['github.com/hyperledger/fabric-contract-api-go'];
}

export class FrameworkRegistry {
  private static adapters: Map<string, FrameworkAdapter> = new Map();

  static initialize() {
    if (this.adapters.size > 0) return;
    this.adapters.set('foundry', new FoundryFrameworkAdapter());
    this.adapters.set('hardhat', new HardhatFrameworkAdapter());
    this.adapters.set('anchor', new AnchorFrameworkAdapter());
    this.adapters.set('aptos-framework', new AptosFrameworkAdapter());
    this.adapters.set('sui-framework', new SuiFrameworkAdapter());
    this.adapters.set('scarb', new ScarbFrameworkAdapter());
    this.adapters.set('cosmwasm', new CosmWasmFrameworkAdapter());
    this.adapters.set('fabric-contract-api', new HyperledgerSDKAdapter());
  }

  static getAdapter(id: string): FrameworkAdapter {
    this.initialize();
    const normalized = (id || 'foundry').toLowerCase().trim();
    return this.adapters.get(normalized) || this.adapters.get('foundry')!;
  }
}
