export interface LanguageAdapter {
  id: string;
  name: string;
  extension: string;
  formattingRules: string[];
  syntaxGuarantees: string[];
  compilerVersion: string;
  securityGuidelines: string[];
  docstyle: string;
}

export class SolidityLanguageAdapter implements LanguageAdapter {
  id = 'solidity';
  name = 'Solidity';
  extension = '.sol';
  formattingRules = ['4 spaces indent', 'CamelCase contract names', 'mixedCase function names'];
  syntaxGuarantees = ['pragma solidity ^0.8.20', 'SPDX-License-Identifier: MIT'];
  compilerVersion = '^0.8.20';
  securityGuidelines = ['CEI pattern', 'Custom errors over string reverts', 'Reentrancy guard on external state-modifying functions'];
  docstyle = 'NatSpec (@notice, @param, @return, @dev)';
}

export class RustLanguageAdapter implements LanguageAdapter {
  id = 'rust';
  name = 'Rust';
  extension = '.rs';
  formattingRules = ['4 spaces indent', 'snake_case function/var names', 'PascalCase struct/enum names'];
  syntaxGuarantees = ['#![no_std] support if embedded', 'Cargo.toml dependency declaration'];
  compilerVersion = '1.78.0';
  securityGuidelines = ['Safe integer math or checked arithmetic', 'Anchor account validation attributes'];
  docstyle = 'Rustdoc (/// markdown comments)';
}

export class MoveLanguageAdapter implements LanguageAdapter {
  id = 'move';
  name = 'Move';
  extension = '.move';
  formattingRules = ['4 spaces indent', 'snake_case functions', 'PascalCase structs'];
  syntaxGuarantees = ['module scope declaration', 'Move.toml configuration'];
  compilerVersion = '2.0.0';
  securityGuidelines = ['Resource safety and capabilities', 'Signer verification'];
  docstyle = 'Move docstrings (/// markdown comments)';
}

export class CairoLanguageAdapter implements LanguageAdapter {
  id = 'cairo';
  name = 'Cairo';
  extension = '.cairo';
  formattingRules = ['4 spaces indent', 'snake_case functions', 'Scarb.toml metadata'];
  syntaxGuarantees = ['#[starknet::contract]', 'starknet::ContractAddress'];
  compilerVersion = '2.6.0';
  securityGuidelines = ['OpenZeppelin Cairo components', 'Storage access safety'];
  docstyle = 'NatSpec / Cairo doc comments';
}

export class CosmWasmLanguageAdapter implements LanguageAdapter {
  id = 'cosmwasm';
  name = 'CosmWasm Rust';
  extension = '.rs';
  formattingRules = ['4 spaces indent', 'cw-storage-plus usage'];
  syntaxGuarantees = ['#[cw_serde]', 'instantiate / execute / query entrypoints'];
  compilerVersion = '1.5.0';
  securityGuidelines = ['Message validation and reply attributes', 'State isolation'];
  docstyle = 'Rustdoc comments';
}

export class GoLanguageAdapter implements LanguageAdapter {
  id = 'go';
  name = 'Go';
  extension = '.go';
  formattingRules = ['gofmt style (tabs)', 'camelCase unexported / PascalCase exported'];
  syntaxGuarantees = ['package declaration', 'go.mod file'];
  compilerVersion = 'go 1.21';
  securityGuidelines = ['Client identity checks', 'Input sanitization'];
  docstyle = 'Go doc comments';
}

export class LanguageRegistry {
  private static adapters: Map<string, LanguageAdapter> = new Map();

  static initialize() {
    if (this.adapters.size > 0) return;
    this.adapters.set('solidity', new SolidityLanguageAdapter());
    this.adapters.set('rust', new RustLanguageAdapter());
    this.adapters.set('move', new MoveLanguageAdapter());
    this.adapters.set('cairo', new CairoLanguageAdapter());
    this.adapters.set('cosmwasm', new CosmWasmLanguageAdapter());
    this.adapters.set('go', new GoLanguageAdapter());
  }

  static getAdapter(id: string): LanguageAdapter {
    this.initialize();
    const normalized = (id || 'solidity').toLowerCase().trim();
    return this.adapters.get(normalized) || this.adapters.get('solidity')!;
  }
}
