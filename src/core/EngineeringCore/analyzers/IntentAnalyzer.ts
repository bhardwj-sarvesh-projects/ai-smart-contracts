import { UserIntent } from '../types';

export class IntentAnalyzer {
  static analyze(prompt: string, existingFilesCount: number = 0): UserIntent {
    const p = prompt.toLowerCase();

    if (p.includes('audit') || p.includes('vulnerability') || p.includes('security check') || p.includes('slither')) {
      return 'Audit';
    }
    if (p.includes('deploy') || p.includes('publish') || p.includes('mainnet') || p.includes('testnet')) {
      return 'Deploy';
    }
    if (p.includes('test') || p.includes('unit test') || p.includes('forge test') || p.includes('coverage')) {
      return 'Test';
    }
    if (p.includes('optimize') || p.includes('gas') || p.includes('storage packing') || p.includes('sload')) {
      return 'Optimize';
    }
    if (p.includes('refactor') || p.includes('clean code') || p.includes('restructure')) {
      return 'Refactor';
    }
    if (p.includes('explain') || p.includes('how does') || p.includes('what is') || p.includes('documentation')) {
      return 'Explain';
    }
    if (p.includes('convert to solana') || p.includes('convert to aptos') || p.includes('convert to ethereum') || p.includes('convert blockchain')) {
      return 'Convert Blockchain';
    }
    if (p.includes('convert to rust') || p.includes('convert to move') || p.includes('convert to cairo') || p.includes('convert language')) {
      return 'Convert Language';
    }
    if (p.includes('migrate') || p.includes('upgrade contract')) {
      return 'Migrate';
    }
    if (p.includes('compare') || p.includes('diff')) {
      return 'Compare';
    }
    if (existingFilesCount > 0 && (p.includes('add') || p.includes('update') || p.includes('fix') || p.includes('change'))) {
      return 'Modify';
    }
    if (existingFilesCount > 0 && (p.includes('continue') || p.includes('next step'))) {
      return 'Continue';
    }

    return 'Create Project';
  }
}
