import { describe, it } from 'vitest';
import { CompilerEngine } from './CompilerEngine';
import { ProjectFile } from '../../../types';
import { getNodeRequire } from '../utils/nodeRequire';

describe('CompilerEngine', () => {
  it('runs compiler engine tests', async () => {
    await runCompilerEngineTests();
  });
});

const requireFn = getNodeRequire();
const crypto = requireFn ? requireFn('crypto') : null;

function computeSha256(content: string): string {
  if (crypto) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    hash = (hash << 5) - hash + content.charCodeAt(i);
    hash |= 0;
  }
  return 'hash-' + Math.abs(hash);
}

function calculateWorkspaceHash(files: ProjectFile[]): string {
  return files.map(f => `${f.path}:${computeSha256(f.content)}`).sort().join('\n');
}

async function runCompilerEngineTests() {
  console.log('🧪 Starting CompilerEngine Truthfulness, Immutability & Negative Tests...\n');

  const mockSolidityFiles: ProjectFile[] = [
    {
      path: 'contracts/GovToken.sol',
      language: 'solidity',
      content: 'pragma solidity ^0.8.20;\ncontract GovToken {\n  string public name = "GovToken";\n}'
    }
  ];

  // Helper to deep copy files
  const copyFiles = (files: ProjectFile[]): ProjectFile[] => files.map(f => ({ ...f }));

  // TEST 1: Forge unavailable
  console.log('TEST 1: Forge unavailable...');
  CompilerEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    return {
      status: null,
      error: new Error('spawnSync forge ENOENT'),
      stdout: '',
      stderr: ''
    };
  };

  const res1 = CompilerEngine.certifyCompilation(copyFiles(mockSolidityFiles), 'TestProj', 'Ethereum/EVM');
  if (res1.result.status !== 'NOT_VERIFIED') {
    throw new Error(`TEST 1 Failed: Expected status NOT_VERIFIED, got ${res1.result.status}`);
  }
  if (res1.result.success !== false) {
    throw new Error(`TEST 1 Failed: Expected success === false, got ${res1.result.success}`);
  }
  if (res1.result.compilerVersion !== 'UNKNOWN') {
    throw new Error(`TEST 1 Failed: Expected UNKNOWN compilerVersion, got ${res1.result.compilerVersion}`);
  }
  if (res1.result.verificationMode !== 'TOOLCHAIN_UNAVAILABLE') {
    throw new Error(`TEST 1 Failed: Expected verificationMode TOOLCHAIN_UNAVAILABLE, got ${res1.result.verificationMode}`);
  }
  console.log('   ✅ PASS');

  // TEST 2: Forge executes and returns exitCode 1
  console.log('TEST 2: Forge executes and returns exitCode 1...');
  CompilerEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) {
      return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    }
    return {
      status: 1,
      stdout: '',
      stderr: 'Error: DeclarationError: Identifier not found'
    };
  };

  const res2 = CompilerEngine.certifyCompilation(copyFiles(mockSolidityFiles), 'TestProj', 'Ethereum/EVM');
  if (res2.result.status !== 'FAIL') {
    throw new Error(`TEST 2 Failed: Expected status FAIL, got ${res2.result.status}`);
  }
  if (res2.result.success !== false) {
    throw new Error(`TEST 2 Failed: Expected success === false, got ${res2.result.success}`);
  }
  if (res2.result.exitCode !== 1) {
    throw new Error(`TEST 2 Failed: Expected exitCode 1, got ${res2.result.exitCode}`);
  }
  console.log('   ✅ PASS');

  // TEST 3: Forge executes and returns exitCode 0
  console.log('TEST 3: Forge executes and returns exitCode 0...');
  CompilerEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) {
      return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    }
    return {
      status: 0,
      stdout: 'Compiler run successful. Out file written.',
      stderr: ''
    };
  };

  const res3 = CompilerEngine.certifyCompilation(copyFiles(mockSolidityFiles), 'TestProj', 'Ethereum/EVM');
  if (res3.result.status !== 'PASS') {
    throw new Error(`TEST 3 Failed: Expected status PASS, got ${res3.result.status}`);
  }
  if (res3.result.success !== true) {
    throw new Error(`TEST 3 Failed: Expected success === true`);
  }
  if (res3.result.verificationMode !== 'REAL_EXECUTION') {
    throw new Error(`TEST 3 Failed: Expected verificationMode REAL_EXECUTION`);
  }
  console.log('   ✅ PASS');

  // TEST 4: Compiler unavailable but source looks syntactically correct
  console.log('TEST 4: Compiler unavailable but source looks syntactically correct...');
  CompilerEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    return { status: null, error: new Error('ENOENT'), stdout: '', stderr: '' };
  };

  const res4 = CompilerEngine.certifyCompilation(copyFiles(mockSolidityFiles), 'TestProj', 'Ethereum/EVM');
  if (res4.result.status !== 'NOT_VERIFIED') {
    throw new Error(`TEST 4 Failed: Expected NOT_VERIFIED, got ${res4.result.status}`);
  }
  if (res4.result.success !== false) {
    throw new Error(`TEST 4 Failed: Static analysis must never bypass native toolchain check to produce true success`);
  }
  if (res4.result.compilerVersion !== 'UNKNOWN') {
    throw new Error(`TEST 4 Failed: Expected UNKNOWN compiler version, got ${res4.result.compilerVersion}`);
  }
  if (res4.result.verificationMode !== 'TOOLCHAIN_UNAVAILABLE') {
    throw new Error(`TEST 4 Failed: Expected verificationMode TOOLCHAIN_UNAVAILABLE, got ${res4.result.verificationMode}`);
  }
  console.log('   ✅ PASS');

  // TEST 5: Compiler unavailable but configuration files are valid
  console.log('TEST 5: Compiler unavailable but configuration files are valid...');
  const filesWithConfig: ProjectFile[] = [
    { path: 'foundry.toml', content: '[profile.default]', language: 'toml' },
    ...mockSolidityFiles
  ];
  const res5 = CompilerEngine.certifyCompilation(copyFiles(filesWithConfig), 'TestProj', 'Ethereum/EVM');
  if (res5.result.status !== 'NOT_VERIFIED') {
    throw new Error(`TEST 5 Failed: Expected NOT_VERIFIED, got ${res5.result.status}`);
  }
  if (res5.result.success !== false) {
    throw new Error(`TEST 5 Failed: Configuration files presence must not produce PASS when compiler is missing`);
  }
  if (res5.result.compilerVersion !== 'UNKNOWN') {
    throw new Error(`TEST 5 Failed: Expected UNKNOWN compiler version, got ${res5.result.compilerVersion}`);
  }
  if (res5.result.verificationMode !== 'TOOLCHAIN_UNAVAILABLE') {
    throw new Error(`TEST 5 Failed: Expected verificationMode TOOLCHAIN_UNAVAILABLE, got ${res5.result.verificationMode}`);
  }
  console.log('   ✅ PASS');

  // TEST 6: Compiler returns syntax error
  console.log('TEST 6: Compiler returns syntax error...');
  CompilerEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) {
      return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    }
    return {
      status: 1,
      stdout: '',
      stderr: 'ParserError: Expected \';\' but got \'}\''
    };
  };

  const res6 = CompilerEngine.certifyCompilation(copyFiles(mockSolidityFiles), 'TestProj', 'Ethereum/EVM');
  if (res6.result.status !== 'FAIL') {
    throw new Error(`TEST 6 Failed: Expected status FAIL`);
  }
  if (res6.result.diagnostics.length === 0) {
    throw new Error(`TEST 6 Failed: Expected parsed syntax error diagnostics`);
  }
  console.log('   ✅ PASS');

  // TEST 7: Compiler times out
  console.log('TEST 7: Compiler times out...');
  CompilerEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) {
      return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    }
    return {
      status: null,
      signal: 'SIGTERM',
      error: { code: 'ETIMEDOUT', message: 'spawnSync ETIMEDOUT' } as any,
      stdout: '',
      stderr: ''
    };
  };

  const res7 = CompilerEngine.certifyCompilation(copyFiles(mockSolidityFiles), 'TestProj', 'Ethereum/EVM');
  if (res7.result.status !== 'FAIL') {
    throw new Error(`TEST 7 Failed: Expected status FAIL, got ${res7.result.status}`);
  }
  if (res7.result.exitCode !== 124) {
    throw new Error(`TEST 7 Failed: Expected exitCode 124 for timeout, got ${res7.result.exitCode}`);
  }
  console.log('   ✅ PASS');

  // TEST 8: Invalid Solidity source is passed to CompilerEngine
  console.log('TEST 8: Invalid Solidity source is passed to CompilerEngine...');
  const invalidSolFiles: ProjectFile[] = [
    {
      path: 'contracts/Bad.sol',
      language: 'solidity',
      content: 'contract Bad {' // Missing closing brace
    }
  ];

  CompilerEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) {
      return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    }
    return {
      status: 1,
      stdout: '',
      stderr: 'ParserError: Expected \'}\' but reached end of file'
    };
  };

  const res8 = CompilerEngine.certifyCompilation(copyFiles(invalidSolFiles), 'TestProj', 'Ethereum/EVM');
  if (res8.result.status !== 'FAIL') {
    throw new Error(`TEST 8 Failed: Expected status FAIL for invalid source`);
  }
  // Verify absolutely no automatic repairs were performed by CompilerEngine
  const badFile = res8.certifiedFiles.find(f => f.path === 'contracts/Bad.sol');
  if (!badFile || badFile.content !== 'contract Bad {') {
    throw new Error(`TEST 8 Failed: CompilerEngine modified/repaired source file automatically!`);
  }
  console.log('   ✅ PASS');

  // TEST 9: Verify source content before and after compilation is identical (NO MUTATION)
  console.log('TEST 9: Verify source content before and after compilation (NO MUTATION)...');
  const inputFiles: ProjectFile[] = [
    {
      path: 'contracts/Token.sol',
      language: 'solidity',
      content: 'pragma solidity ^0.8.20;\ncontract Token {}'
    },
    {
      path: 'test/Token.t.sol',
      language: 'solidity',
      content: 'contract TokenTest {}'
    }
  ];

  const preHash = calculateWorkspaceHash(inputFiles);

  CompilerEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    return { status: 0, stdout: 'built', stderr: '' };
  };

  const res9 = CompilerEngine.certifyCompilation(copyFiles(inputFiles), 'TestProj', 'Ethereum/EVM');
  
  // Exclude COMPILATION_REPORT.md which is generated and appended
  const filteredOutputFiles = res9.certifiedFiles.filter(f => f.path !== 'COMPILATION_REPORT.md');
  const postHash = calculateWorkspaceHash(filteredOutputFiles);

  if (preHash !== postHash) {
    throw new Error('TEST 9 Failed: Workspace source files mutated during compilation pipeline!');
  }
  console.log('   ✅ PASS');

  console.log('\n==========================================');
  console.log('🎉 ALL COMPILER ENGINE TESTS PASSED!');
  console.log('==========================================\n');
}

runCompilerEngineTests().catch(err => {
  console.error('❌ CompilerEngine Test Failed:', err);
  process.exit(1);
});
