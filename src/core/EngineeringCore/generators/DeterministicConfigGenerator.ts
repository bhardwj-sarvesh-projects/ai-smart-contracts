export class DeterministicConfigGenerator {
  public static getConfigFile(targetPath: string, profile?: any): string | null {
    const filename = (targetPath.split('/').pop() || '').toLowerCase();

    if (filename === '.env.example' || filename === '.env') {
      return `# Network and Node Configuration
RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
PRIVATE_KEY=0x0000000000000000000000000000000000000000000000000000000000000000
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_API_KEY
GROQ_API_KEY=
OPENAI_API_KEY=`;
    }

    if (filename === 'foundry.toml') {
      const srcDir = (profile?.directoryLayout || []).some((p: string) => p.startsWith('contracts/')) ? 'contracts' : 'src';
      return `[profile.default]
src = "${srcDir}"
out = "out"
libs = ["lib"]
solc = "0.8.20"
remappings = [
  "@openzeppelin/contracts/=../node_modules/@openzeppelin/contracts/",
  "@openzeppelin/contracts-upgradeable/=../node_modules/@openzeppelin/contracts-upgradeable/",
  "forge-std/=../lib/forge-std/src/"
]`;
    }

    if (filename === 'package.json') {
      const projName = (profile?.contractType || 'smart-contract-project').toLowerCase().replace(/\s+/g, '-');
      return JSON.stringify({
        name: projName,
        version: "1.0.0",
        description: "Smart Contract Project",
        main: "index.js",
        scripts: {
          build: "forge build",
          test: "forge test"
        },
        dependencies: {
          "@openzeppelin/contracts": "^5.0.0"
        },
        devDependencies: {
          "typescript": "^5.0.0"
        }
      }, null, 2);
    }

    if (filename === 'tsconfig.json') {
      return JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "CommonJS",
          moduleResolution: "node",
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true
        },
        include: ["scripts/**/*", "test/**/*", "tests/**/*"]
      }, null, 2);
    }

    if (filename === 'anchor.toml') {
      return `[toolchain]

[features]
seeds = true
skip-lint = false

[programs.localnet]
smart_contract = "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"

[registry]
url = "https://api.apr.dev"

[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"`;
    }

    if (filename === 'cargo.toml') {
      const projName = (profile?.contractType || 'smart_contract_project').toLowerCase().replace(/\s+/g, '_');
      return `[package]
name = "${projName}"
version = "0.1.0"
description = "Created with Anchor"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]
name = "${projName}"

[features]
no-entrypoint = []
no-idl = []
no-log-ix-name = []
cpi = ["no-entrypoint"]
default = []

[dependencies]
anchor-lang = "0.29.0"`;
    }

    if (filename === 'move.toml') {
      return `[package]
name = "SmartContractProject"
version = "1.0.0"

[dependencies]
AptosFramework = { git = "https://github.com/aptos-labs/aptos-core.git", rev = "mainnet", subdir = "aptos-move/framework/aptos-framework" }

[addresses]
std = "0x1"
aptos_framework = "0x1"
main = "_"`;
    }

    return null;
  }
}
