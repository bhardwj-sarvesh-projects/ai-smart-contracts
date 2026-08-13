import { describe, it } from 'vitest';
import { TestingValidationEngine } from './TestingValidationEngine';
import { ProjectFile } from '../../../types';

describe('TestingValidationEngine', () => {
  it('runs testing validation engine tests', async () => {
    await runTestingEngineTests();
  });
});

async function runTestingEngineTests() {
  console.log('🧪 Starting TestingValidationEngine Truthfulness & Negative Tests...\n');

  const mockFiles: ProjectFile[] = [
    {
      path: 'contracts/GovToken.sol',
      language: 'solidity',
      content: 'pragma solidity ^0.8.20; contract GovToken {}'
    },
    {
      path: 'test/GovToken.t.sol',
      language: 'solidity',
      content: 'contract GovTokenTest { function test_Initial() public { assertTrue(true); } }'
    }
  ];

  // TEST 1: Forge unavailable. Expected: NOT_VERIFIED (NOT PASS).
  console.log('TEST 1: Forge unavailable...');
  TestingValidationEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    return {
      status: null,
      error: new Error('spawnSync forge ENOENT'),
      stdout: '',
      stderr: ''
    };
  };

  const res1 = TestingValidationEngine.certifyTesting(mockFiles, 'TestProj', 'prompt', 'Ethereum/EVM');
  if (res1.status !== 'NOT_VERIFIED') {
    throw new Error(`TEST 1 Failed: Expected NOT_VERIFIED, got ${res1.status}`);
  }
  if (res1.verificationMode !== 'TOOLCHAIN_UNAVAILABLE') {
    throw new Error(`TEST 1 Failed: Expected verificationMode TOOLCHAIN_UNAVAILABLE, got ${res1.verificationMode}`);
  }
  if (res1.testingPassed !== false) {
    throw new Error(`TEST 1 Failed: Expected testingPassed === false, got ${res1.testingPassed}`);
  }
  if (res1.score !== null) {
    throw new Error(`TEST 1 Failed: Expected score === null, got ${res1.score}`);
  }
  if (res1.coverageReport.overallCoverage !== 'NOT_MEASURED') {
    throw new Error(`TEST 1 Failed: Expected coverage === 'NOT_MEASURED'`);
  }
  if (res1.regressionResult.totalTests !== 'NOT_MEASURED' || res1.regressionResult.passCount !== 'NOT_MEASURED') {
    throw new Error(`TEST 1 Failed: Expected NOT_MEASURED in regressionResult metrics, got: ${JSON.stringify(res1.regressionResult)}`);
  }
  console.log('   ✅ PASS');

  // TEST 2: Forge exists but returns exitCode 1. Expected: FAIL.
  console.log('TEST 2: Forge exists but returns exitCode 1...');
  TestingValidationEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) {
      return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    }
    return {
      status: 1,
      stdout: 'Running 1 test\nTest test_Initial failed',
      stderr: 'Assertion failed'
    };
  };

  const res2 = TestingValidationEngine.certifyTesting(mockFiles, 'TestProj', 'prompt', 'Ethereum/EVM');
  if (res2.status !== 'FAIL') {
    throw new Error(`TEST 2 Failed: Expected FAIL, got ${res2.status}`);
  }
  if (res2.verificationMode !== 'REAL_EXECUTION') {
    throw new Error(`TEST 2 Failed: Expected REAL_EXECUTION verificationMode, got ${res2.verificationMode}`);
  }
  if (res2.exitCode !== 1) {
    throw new Error(`TEST 2 Failed: Expected exitCode === 1, got ${res2.exitCode}`);
  }
  if (res2.stdout !== 'Running 1 test\nTest test_Initial failed') {
    throw new Error(`TEST 2 Failed: Output mismatch`);
  }
  if (res2.score !== null) {
    throw new Error(`TEST 2 Failed: Expected score === null`);
  }
  if (res2.regressionResult.totalTests !== 'NOT_MEASURED' || res2.regressionResult.passCount !== 'NOT_MEASURED') {
    throw new Error(`TEST 2 Failed: Expected NOT_MEASURED in regressionResult metrics, got: ${JSON.stringify(res2.regressionResult)}`);
  }
  console.log('   ✅ PASS');

  // TEST 3: Forge exists and returns exitCode 0. Expected: PASS.
  console.log('TEST 3: Forge exists and returns exitCode 0...');
  TestingValidationEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) {
      return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    }
    return {
      status: 0,
      stdout: 'Running 1 test\nTest test_Initial passed',
      stderr: ''
    };
  };

  const preMockFilesStr = JSON.stringify(mockFiles);
  const res3 = TestingValidationEngine.certifyTesting(mockFiles, 'TestProj', 'prompt', 'Ethereum/EVM');
  if (res3.status !== 'PASS') {
    throw new Error(`TEST 3 Failed: Expected PASS, got ${res3.status}`);
  }
  if (res3.verificationMode !== 'REAL_EXECUTION') {
    throw new Error(`TEST 3 Failed: Expected REAL_EXECUTION verificationMode, got ${res3.verificationMode}`);
  }
  if (res3.testingPassed !== true) {
    throw new Error(`TEST 3 Failed: Expected testingPassed === true`);
  }
  if (res3.score !== null) {
    throw new Error(`TEST 3 Failed: Expected score === null`);
  }
  if (res3.coverageReport.overallCoverage !== 'NOT_MEASURED') {
    throw new Error(`TEST 3 Failed: Expected coverage === 'NOT_MEASURED'`);
  }
  if (JSON.stringify(mockFiles) !== preMockFilesStr) {
    throw new Error(`TEST 3 Failed: Input files were mutated during testing validation!`);
  }
  if (res3.evidence.testFilesDiscovered.length !== 1 || res3.evidence.testFilesDiscovered[0] !== 'test/GovToken.t.sol') {
    throw new Error(`TEST 3 Failed: Unexpected testFilesDiscovered`);
  }
  if (res3.evidence.testFilesExecuted.length !== 0) {
    throw new Error(`TEST 3 Failed: Expected testFilesExecuted to be empty, got: ${JSON.stringify(res3.evidence.testFilesExecuted)}`);
  }
  if (res3.totalTestsDiscovered !== 1 || res3.evidence.totalTestsDiscovered !== 1) {
    throw new Error(`TEST 3 Failed: Expected 1 totalTestsDiscovered, got ${res3.totalTestsDiscovered}`);
  }
  if (res3.regressionResult.totalTests !== 'NOT_MEASURED' || res3.regressionResult.passCount !== 'NOT_MEASURED') {
    throw new Error(`TEST 3 Failed: Expected NOT_MEASURED in regressionResult metrics, got: ${JSON.stringify(res3.regressionResult)}`);
  }
  console.log('   ✅ PASS');

  // TEST 4: Static test files contain valid assertions but forge is unavailable. Expected: NOT_VERIFIED.
  console.log('TEST 4: Static test files with valid assertions but forge is unavailable...');
  TestingValidationEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    return {
      status: null,
      error: new Error('spawnSync forge ENOENT'),
      stdout: '',
      stderr: ''
    };
  };

  const res4 = TestingValidationEngine.certifyTesting(mockFiles, 'TestProj', 'prompt', 'Ethereum/EVM');
  if (res4.status !== 'NOT_VERIFIED') {
    throw new Error(`TEST 4 Failed: Expected NOT_VERIFIED, got ${res4.status}`);
  }
  if (res4.verificationMode !== 'TOOLCHAIN_UNAVAILABLE') {
    throw new Error(`TEST 4 Failed: Expected TOOLCHAIN_UNAVAILABLE, got ${res4.verificationMode}`);
  }
  if (res4.testingPassed !== false) {
    throw new Error(`TEST 4 Failed: Expected testingPassed === false`);
  }
  console.log('   ✅ PASS');

  // TEST 5: Static test files contain invalid-looking content but forge is unavailable. Expected: NOT_VERIFIED.
  console.log('TEST 5: Static test files with invalid content and forge unavailable...');
  const invalidFiles: ProjectFile[] = [
    {
      path: 'test/BadFile.t.sol',
      language: 'solidity',
      content: 'this is not valid solidity code at all!'
    }
  ];

  const res5 = TestingValidationEngine.certifyTesting(invalidFiles, 'TestProj', 'prompt', 'Ethereum/EVM');
  if (res5.status !== 'NOT_VERIFIED') {
    throw new Error(`TEST 5 Failed: Expected NOT_VERIFIED, got ${res5.status}`);
  }
  console.log('   ✅ PASS');

  // TEST 6: Actual test command times out. Expected: FAIL.
  console.log('TEST 6: Actual test command times out...');
  TestingValidationEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
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

  const res6 = TestingValidationEngine.certifyTesting(mockFiles, 'TestProj', 'prompt', 'Ethereum/EVM');
  if (res6.status !== 'FAIL') {
    throw new Error(`TEST 6 Failed: Expected FAIL, got ${res6.status}`);
  }
  if (res6.exitCode !== 124) {
    throw new Error(`TEST 6 Failed: Expected exitCode 124, got ${res6.exitCode}`);
  }
  console.log('   ✅ PASS');

  // TEST 7: Actual test command succeeds. Expected: PASS with: verificationMode = REAL_EXECUTION
  console.log('TEST 7: Actual test command succeeds...');
  TestingValidationEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (args.includes('--version')) {
      return { status: 0, stdout: 'forge 0.2.0', stderr: '' };
    }
    return {
      status: 0,
      stdout: 'All tests passed!',
      stderr: ''
    };
  };

  const res7 = TestingValidationEngine.certifyTesting(mockFiles, 'TestProj', 'prompt', 'Ethereum/EVM');
  if (res7.status !== 'PASS') {
    throw new Error(`TEST 7 Failed: Expected PASS, got ${res7.status}`);
  }
  if (res7.verificationMode !== 'REAL_EXECUTION') {
    throw new Error(`TEST 7 Failed: Expected REAL_EXECUTION, got ${res7.verificationMode}`);
  }
  console.log('   ✅ PASS');

  // TEST 8: Hardhat unavailable locally. Expected: NOT_VERIFIED, TOOLCHAIN_UNAVAILABLE
  console.log('TEST 8: Hardhat project but Hardhat binary unavailable...');
  const hardhatFiles: ProjectFile[] = [
    { path: 'hardhat.config.js', language: 'javascript', content: 'module.exports = {};' },
    { path: 'test/sample.test.js', language: 'javascript', content: 'it("works", () => {});' }
  ];

  TestingValidationEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    return {
      status: 1,
      error: new Error('ENOENT'),
      stdout: '',
      stderr: 'npm error npx canceled due to missing packages'
    };
  };

  const res8 = TestingValidationEngine.certifyTesting(hardhatFiles, 'HardhatProj', 'prompt', 'Ethereum/EVM');
  if (res8.status !== 'NOT_VERIFIED') {
    throw new Error(`TEST 8 Failed: Expected NOT_VERIFIED, got ${res8.status}`);
  }
  if (res8.verificationMode !== 'TOOLCHAIN_UNAVAILABLE') {
    throw new Error(`TEST 8 Failed: Expected TOOLCHAIN_UNAVAILABLE, got ${res8.verificationMode}`);
  }
  console.log('   ✅ PASS');

  // TEST 9: Hardhat available locally and test succeeds. Expected: PASS, REAL_EXECUTION
  console.log('TEST 9: Hardhat project with Hardhat binary available and tests passing...');
  TestingValidationEngine.spawnSyncFn = (binary: string, args: string[], options: any) => {
    if (binary === 'hardhat' && args.includes('--version')) {
      return { status: 0, stdout: 'hardhat 2.19.0', stderr: '' };
    }
    return {
      status: 0,
      stdout: '1 passing (50ms)',
      stderr: ''
    };
  };

  const res9 = TestingValidationEngine.certifyTesting(hardhatFiles, 'HardhatProj', 'prompt', 'Ethereum/EVM');
  if (res9.status !== 'PASS') {
    throw new Error(`TEST 9 Failed: Expected PASS, got ${res9.status}`);
  }
  if (res9.verificationMode !== 'REAL_EXECUTION') {
    throw new Error(`TEST 9 Failed: Expected REAL_EXECUTION, got ${res9.verificationMode}`);
  }
  console.log('   ✅ PASS');

  console.log('\n==========================================');
  console.log('🎉 ALL TESTING VALIDATION ENGINE TESTS PASSED!');
  console.log('==========================================\n');
}

runTestingEngineTests().catch(err => {
  console.error('❌ TestingValidationEngine Test Failed:', err);
  process.exit(1);
});
