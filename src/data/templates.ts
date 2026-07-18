import { SmartContractTemplate } from '../types';

export const BLOCKCHAINS = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Truffle', 'Remix'], defaultExtension: 'sol' },
      { id: 'vyper', name: 'Vyper', frameworks: ['Brownie', 'Titan', 'Remix'], defaultExtension: 'vy' }
    ]
  },
  {
    id: 'solana',
    name: 'Solana',
    languages: [
      { id: 'rust-anchor', name: 'Rust (Anchor)', frameworks: ['Anchor'], defaultExtension: 'rs' },
      { id: 'rust-native', name: 'Native Rust', frameworks: ['Native SDK'], defaultExtension: 'rs' },
      { id: 'solidity-solang', name: 'Solidity (Solang)', frameworks: ['Solang'], defaultExtension: 'sol' },
      { id: 'python-seahorse', name: 'Seahorse Python', frameworks: ['Seahorse'], defaultExtension: 'py' }
    ]
  },
  {
    id: 'sui',
    name: 'Sui',
    languages: [
      { id: 'move', name: 'Move', frameworks: ['Sui Move Framework'], defaultExtension: 'move' }
    ]
  },
  {
    id: 'aptos',
    name: 'Aptos',
    languages: [
      { id: 'move', name: 'Move', frameworks: ['Aptos Move Framework'], defaultExtension: 'move' }
    ]
  },
  {
    id: 'base',
    name: 'Base',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Remix'], defaultExtension: 'sol' },
      { id: 'vyper', name: 'Vyper', frameworks: ['Remix'], defaultExtension: 'vy' }
    ]
  },
  {
    id: 'polygon',
    name: 'Polygon',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Remix'], defaultExtension: 'sol' }
    ]
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Remix'], defaultExtension: 'sol' },
      { id: 'rust-arbitrum', name: 'Rust (Stylus)', frameworks: ['Cargo Stylus'], defaultExtension: 'rs' }
    ]
  },
  {
    id: 'optimism',
    name: 'Optimism',
    languages: [
      { id: 'solidity', name: 'Solidity', frameworks: ['Hardhat', 'Foundry', 'Remix'], defaultExtension: 'sol' }
    ]
  },
  {
    id: 'ton',
    name: 'TON',
    languages: [
      { id: 'tact', name: 'Tact', frameworks: ['Tact Blueprint'], defaultExtension: 'tact' },
      { id: 'func', name: 'FunC', frameworks: ['FunC SDK'], defaultExtension: 'fc' }
    ]
  },
  {
    id: 'cosmos',
    name: 'Cosmos',
    languages: [
      { id: 'rust-cosmwasm', name: 'Rust (CosmWasm)', frameworks: ['CosmWasm'], defaultExtension: 'rs' }
    ]
  }
];

export const TEMPLATES: SmartContractTemplate[] = [
  {
    id: 'eth-erc20',
    name: 'ERC20 Token',
    description: 'Standard fungible token implementation with OpenZeppelin security guidelines.',
    blockchain: 'ethereum',
    language: 'solidity',
    framework: 'Hardhat',
    type: 'ERC20',
    files: [
      {
        path: 'contracts/Token.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Enterprise ERC20 Token
 * @dev Full-featured ERC20 token with minting, burning, and pausable controls.
 */
contract MyToken is ERC20, ERC20Burnable, Pausable, Ownable {
    constructor(string memory name, string memory symbol, uint256 initialSupply) 
        ERC20(name, symbol) 
        Ownable(msg.sender) 
    {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // Required overrides
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20)
        whenNotPaused
    {
        super._update(from, to, value);
    }
}`
      },
      {
        path: 'test/Token.test.js',
        language: 'javascript',
        content: `const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ERC20 Token", function () {
  let Token, token, owner, addr1;

  beforeEach(async function () {
    [owner, addr1] = await ethers.getSigners();
    Token = await ethers.getContractFactory("MyToken");
    token = await Token.deploy("MyToken", "MTK", 1000000);
  });

  it("Should assign the total supply to the owner", async function () {
    const ownerBalance = await token.balanceOf(owner.address);
    expect(await token.totalSupply()).to.equal(ownerBalance);
  });

  it("Should mint tokens to address when authorized", async function () {
    await token.mint(addr1.address, 500);
    expect(await token.balanceOf(addr1.address)).to.equal(500);
  });
});`
      },
      {
        path: 'scripts/deploy.js',
        language: 'javascript',
        content: `const hre = require("hardhat");

async function main() {
  console.log("Starting deployment...");
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contract with the account:", deployer.address);

  const Token = await hre.ethers.getContractFactory("MyToken");
  const token = await Token.deploy("MyToken", "MTK", 1000000);

  await token.waitForDeployment();
  console.log("Token deployed to:", await token.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});`
      },
      {
        path: 'README.md',
        language: 'markdown',
        content: `# Enterprise ERC20 Smart Contract

This project includes a complete ERC20 standard token deployment package.

## Features
- **ERC20 standard compliance**: Fully standard compliant.
- **Pausable**: Contract owner can halt operations during emergencies.
- **Ownable**: Controlled access for administrative tasks.

## Getting Started
\`\`\`bash
npm install
npx hardhat compile
npx hardhat test
\`\`\`
`
      }
    ]
  },
  {
    id: 'sol-escrow',
    name: 'Escrow Contract',
    description: 'Solana Anchor Escrow contract allowing safe exchange of assets between Maker and Taker.',
    blockchain: 'solana',
    language: 'rust-anchor',
    framework: 'Anchor',
    type: 'Escrow',
    files: [
      {
        path: 'programs/escrow/src/lib.rs',
        language: 'rust',
        content: `use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod escrow {
    use super::*;

    pub fn make(ctx: Context<Make>, amount: u64, receive_amount: u64) -> Result<()> {
        let escrow = &mut ctx.accounts.escrow;
        escrow.maker = ctx.accounts.maker.key();
        escrow.maker_token = ctx.accounts.maker_token.key();
        escrow.taker_token = ctx.accounts.taker_token.key();
        escrow.receive_amount = receive_amount;

        // Transfer maker's tokens into the escrow vault (PDA)
        let cpi_accounts = Transfer {
            from: ctx.accounts.maker_token.to_account_info(),
            to: ctx.accounts.vault.to_account_info(),
            authority: ctx.accounts.maker.to_account_info(),
        };
        let cpi_ctx = Context::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            &[]
        );
        token::transfer(cpi_ctx, amount)?;

        Ok(())
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {
        // Taker transfers taker_token to maker
        let cpi_accounts = Transfer {
            from: ctx.accounts.taker_token.to_account_info(),
            to: ctx.accounts.maker_vault.to_account_info(),
            authority: ctx.accounts.taker.to_account_info(),
        };
        let cpi_ctx = Context::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            &[]
        );
        token::transfer(cpi_ctx, ctx.accounts.escrow.receive_amount)?;

        // Escrow transfers vault tokens to taker
        let seeds = &[
            b"escrow",
            ctx.accounts.escrow.maker.as_ref(),
            &[ctx.accounts.escrow.bump],
        ];
        let signer = &[&seeds[..]];
        let cpi_vault_accounts = Transfer {
            from: ctx.accounts.vault.to_account_info(),
            to: ctx.accounts.taker_vault.to_account_info(),
            authority: ctx.accounts.vault.to_account_info(),
        };
        let cpi_vault_ctx = Context::new(
            ctx.accounts.token_program.to_account_info(),
            cpi_vault_accounts,
            signer
        );
        token::transfer(cpi_vault_ctx, ctx.accounts.vault.amount)?;

        Ok(())
    }
}

#[account]
pub struct Escrow {
    pub maker: Pubkey,
    pub maker_token: Pubkey,
    pub taker_token: Pubkey,
    pub receive_amount: u64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct Make<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,
    #[account(mut)]
    pub maker_token: Account<'info, TokenAccount>,
    #[account(init, payer = maker, space = 8 + 32 + 32 + 32 + 8 + 1)]
    pub escrow: Account<'info, Escrow>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Take<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,
    #[account(mut)]
    pub taker_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub maker_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub taker_vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut)]
    pub escrow: Account<'info, Escrow>,
    pub token_program: Program<'info, Token>,
}`
      }
    ]
  },
  {
    id: 'sui-move-escrow',
    name: 'Sui Escrow',
    description: 'An elegant Sui Move escrow smart contract.',
    blockchain: 'sui',
    language: 'move',
    framework: 'Sui Move Framework',
    type: 'Escrow',
    files: [
      {
        path: 'sources/escrow.move',
        language: 'move',
        content: `module escrow::escrow {
    use sui::object::{Self, UID, ID};
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::transfer;

    struct Escrow<phantom T1, phantom T2> has key, store {
        id: UID,
        maker: address,
        taker: address,
        maker_coin: Coin<T1>,
        expected_amount: u64,
    }

    public fun create_escrow<T1, T2>(
        maker_coin: Coin<T1>,
        expected_amount: u64,
        taker: address,
        ctx: &mut TxContext
    ) {
        let id = object::new(ctx);
        let maker = tx_context::sender(ctx);

        let escrow = Escrow<T1, T2> {
            id,
            maker,
            taker,
            maker_coin,
            expected_amount,
        };

        transfer::share_object(escrow);
    }

    public fun exchange<T1, T2>(
        escrow: Escrow<T1, T2>,
        taker_coin: &mut Coin<T2>,
        ctx: &mut TxContext
    ) {
        let taker = tx_context::sender(ctx);
        assert!(taker == escrow.taker, 401); // Unauthorised Taker
        
        let taker_payment = coin::split(taker_coin, escrow.expected_amount, ctx);
        
        let Escrow { id, maker, taker: _, maker_coin, expected_amount: _ } = escrow;
        object::delete(id);

        transfer::public_transfer(taker_payment, maker);
        transfer::public_transfer(maker_coin, taker);
    }
}`
      }
    ]
  }
];
