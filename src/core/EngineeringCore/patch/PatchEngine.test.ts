import { describe, it, expect } from 'vitest';
import { ProjectFile } from '../../../types';
import { PatchEngine } from './PatchEngine';

const sampleFiles: ProjectFile[] = [
  { path: 'contracts/Token.sol', language: 'solidity', content: 'pragma solidity ^0.8.20; contract Token { uint256 public balance; }' },
  { path: 'contracts/Vault.sol', language: 'solidity', content: 'pragma solidity ^0.8.20; contract Vault { mapping(address => uint) public balances; }' }
];

describe('PatchEngine - FIX #5 Authoritative Isolation and Hash Rollback Integrity', () => {
  it('createSnapshotWithHashes records immutable pre-patch SHA-256 hashes for all workspace files', () => {
    const snapshot = PatchEngine.createSnapshotWithHashes(sampleFiles);

    expect(snapshot.snapshotId).toBeDefined();
    expect(snapshot.timestamp).toBeDefined();
    expect(snapshot.files.length).toBe(sampleFiles.length);
    expect(Object.keys(snapshot.hashes).length).toBe(sampleFiles.length);

    expect(snapshot.hashes['contracts/token.sol']).toBeDefined();
    expect(snapshot.hashes['contracts/vault.sol']).toBeDefined();
    expect(typeof snapshot.hashes['contracts/token.sol']).toBe('string');
    expect(snapshot.hashes['contracts/token.sol'].length).toBe(64); // SHA-256 hex string length
  });

  it('validatePatchScope allows valid edits to target files', () => {
    const patch = {
      modifiedFiles: [
        { path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20; contract Token { uint256 public balance; uint256 public owner; }' }
      ]
    };

    const res = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], sampleFiles);
    expect(res.valid).toBe(true);
  });

  it('validatePatchScope rejects path traversal attempts (../)', () => {
    const patch = {
      modifiedFiles: [
        { path: '../contracts/Token.sol', content: 'hacked' }
      ]
    };

    const res = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], sampleFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Path traversal');
  });

  it('validatePatchScope rejects absolute paths (/etc/passwd)', () => {
    const patch = {
      modifiedFiles: [
        { path: '/etc/passwd', content: 'hacked' }
      ]
    };

    const res = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], sampleFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('absolute path');
  });

  it('validatePatchScope rejects modifications outside allowed target scope', () => {
    const patch = {
      modifiedFiles: [
        { path: 'contracts/Vault.sol', content: 'modified without scope permission' }
      ]
    };

    const res = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], sampleFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('outside allowed');
  });

  it('validatePatchScope rejects modifications to internal diagnostic files', () => {
    const patch = {
      modifiedFiles: [
        { path: '.diagnostics/audit_report.json', content: '{}' }
      ]
    };

    const res = PatchEngine.validatePatchScope(patch, ['.diagnostics/audit_report.json'], sampleFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('internal system file');
  });

  it('validatePatchScope rejects patch containing AI provider error content', () => {
    const patch = {
      modifiedFiles: [
        { path: 'contracts/Token.sol', content: '[Gemini Error] Rate limit exceeded' }
      ]
    };

    const res = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], sampleFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('contains AI provider error');
  });

  it('verifyPatchImmutability fails if non-target file is mutated', () => {
    const mutatedFiles: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'modified token' },
      { path: 'contracts/Vault.sol', language: 'solidity', content: 'UNAUTHORIZED VAULT MUTATION' }
    ];

    const res = PatchEngine.verifyPatchImmutability(sampleFiles, mutatedFiles, ['contracts/Token.sol']);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('contracts/vault.sol');
  });

  it('verifyPatchImmutability passes when only target file is mutated', () => {
    const mutatedFiles: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'modified token' },
      { path: 'contracts/Vault.sol', language: 'solidity', content: sampleFiles[1].content }
    ];

    const res = PatchEngine.verifyPatchImmutability(sampleFiles, mutatedFiles, ['contracts/Token.sol']);
    expect(res.valid).toBe(true);
  });

  it('verifyRollback passes when workspace is restored byte-for-byte to snapshot hashes', () => {
    const snapshot = PatchEngine.createSnapshotWithHashes(sampleFiles);
    const restoredWorkspace = PatchEngine.createSnapshot(sampleFiles);

    const res = PatchEngine.verifyRollback(snapshot.hashes, restoredWorkspace);
    expect(res.valid).toBe(true);
  });

  it('verifyRollback fails when file content differs from snapshot hash', () => {
    const snapshot = PatchEngine.createSnapshotWithHashes(sampleFiles);
    const corruptedWorkspace: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'CORRUPTED CONTENT' },
      { path: 'contracts/Vault.sol', language: 'solidity', content: sampleFiles[1].content }
    ];

    const res = PatchEngine.verifyRollback(snapshot.hashes, corruptedWorkspace);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('hash mismatch');
  });

  it('verifyRollback fails when file count or paths differ', () => {
    const snapshot = PatchEngine.createSnapshotWithHashes(sampleFiles);
    const incompleteWorkspace: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: sampleFiles[0].content }
    ];

    const res = PatchEngine.verifyRollback(snapshot.hashes, incompleteWorkspace);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('is missing');
  });
});
