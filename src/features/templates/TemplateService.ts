import { SmartContractTemplate } from '../../types';

export class TemplateService {
  static getBuiltinTemplates(): SmartContractTemplate[] {
    return [
      {
        id: 'tpl-erc20',
        name: 'Enterprise ERC-20 Token',
        description: 'Production-ready ERC-20 with EIP-2612 Permit and AccessControl roles.',
        blockchain: 'ethereum',
        language: 'solidity',
        framework: 'foundry',
        type: 'ERC-20 Token',
        files: [
          {
            path: 'src/Token.sol',
            content: `// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport "@openzeppelin/contracts/token/ERC20/ERC20.sol";\nimport "@openzeppelin/contracts/access/Ownable.sol";\n\ncontract EnterpriseToken is ERC20, Ownable {\n    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {\n        _mint(msg.sender, 1_000_000 * 10 ** decimals());\n    }\n}\n`,
            language: 'solidity',
          },
        ],
      },
      {
        id: 'tpl-anchor-solana',
        name: 'Solana Anchor Vault',
        description: 'Anchor program vault with PDA derivation and rent-exempt state.',
        blockchain: 'solana',
        language: 'rust',
        framework: 'anchor',
        type: 'Vault',
        files: [
          {
            path: 'src/lib.rs',
            content: `use anchor_lang::prelude::*;\n\ndeclare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");\n\n#[program]\npub mod anchor_vault {\n    use super::*;\n    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {\n        Ok(())\n    }\n}\n\n#[derive(Accounts)]\npub struct Initialize {}\n`,
            language: 'rust',
          },
        ],
      },
      {
        id: 'tpl-aptos-fa',
        name: 'Aptos Fungible Asset',
        description: 'Aptos Move Fungible Asset protocol with capability controllers.',
        blockchain: 'aptos',
        language: 'move',
        framework: 'aptos-framework',
        type: 'Fungible Asset',
        files: [
          {
            path: 'sources/asset.move',
            content: `module my_addr::asset {\n    use std::signer;\n    struct AssetStore has key { balance: u64 }\n    public entry fn initialize(account: &signer) {\n        move_to(account, AssetStore { balance: 0 });\n    }\n}\n`,
            language: 'move',
          },
        ],
      },
    ];
  }
}
