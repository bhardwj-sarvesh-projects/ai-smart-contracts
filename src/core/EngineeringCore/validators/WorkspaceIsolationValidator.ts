import { ProjectFile } from '../../../types';

export class WorkspaceIsolationValidator {
  /**
   * Filters and sanitizes files to enforce strict ecosystem isolation.
   * Removes cross-chain files depending on the active ecosystem.
   */
  public static validateAndClean(
    files: ProjectFile[],
    ecosystem: 'evm' | 'solana' | 'move' | 'generic'
  ): ProjectFile[] {
    console.log(`[WorkspaceIsolationValidator] Enforcing isolation for ecosystem: ${ecosystem}`);
    
    return files.filter(file => {
      const path = file.path.replace(/\\/g, '/').toLowerCase();
      
      // Blacklist patterns based on target ecosystem
      if (ecosystem === 'evm') {
        // EVM projects cannot contain Solana (Anchor/Cargo) or Move assets
        if (
          path.startsWith('programs/') ||
          path.startsWith('sources/') ||
          path.startsWith('tests/') || // Solana test folder is "tests", EVM is "test"
          path === 'anchor.toml' ||
          path === 'cargo.toml' ||
          path === 'move.toml'
        ) {
          console.warn(`[WorkspaceIsolationValidator] Rejecting cross-chain contaminated file in EVM workspace: ${file.path}`);
          return false;
        }
      } else if (ecosystem === 'solana') {
        // Solana projects cannot contain EVM (contracts, script) or Move assets
        if (
          path.startsWith('contracts/') ||
          path.startsWith('script/') ||
          path.startsWith('test/') || // EVM test folder is "test"
          path.startsWith('sources/') ||
          path === 'foundry.toml' ||
          path.startsWith('hardhat.config') ||
          path === 'move.toml'
        ) {
          console.warn(`[WorkspaceIsolationValidator] Rejecting cross-chain contaminated file in Solana workspace: ${file.path}`);
          return false;
        }
      } else if (ecosystem === 'move') {
        // Move projects cannot contain EVM or Solana assets
        if (
          path.startsWith('contracts/') ||
          path.startsWith('script/') ||
          path.startsWith('test/') ||
          path.startsWith('programs/') ||
          path === 'foundry.toml' ||
          path.startsWith('hardhat.config') ||
          path === 'anchor.toml' ||
          path === 'cargo.toml'
        ) {
          console.warn(`[WorkspaceIsolationValidator] Rejecting cross-chain contaminated file in Move workspace: ${file.path}`);
          return false;
        }
      }
      
      return true;
    });
  }
}
