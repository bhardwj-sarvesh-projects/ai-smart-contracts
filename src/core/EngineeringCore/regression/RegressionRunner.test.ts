import { describe, it, expect } from 'vitest';
import { RegressionRunner } from './RegressionRunner';
import { EngineeringCertificationEngine } from '../certification/EngineeringCertificationEngine';
import { ExportEngine } from '../export/ExportEngine';
import { BenchmarkDefinition } from './BenchmarkManager';
import { PromptVariation } from './PromptGenerator';
import { AuthoritativePipelineRouter } from '../pipeline/AuthoritativePipelineRouter';
import { CompilerEngine } from '../compiler/CompilerEngine';
import { ResponseParser } from '../parsers/ResponseParser';
import { UniversalPipeline } from '../pipeline/UniversalPipeline';

describe('RegressionRunner Truthfulness & Verification Tests', () => {
  const sampleBenchmark: BenchmarkDefinition = {
    id: 'TEST-BENCHMARK-01',
    name: 'ERC20 Token Test Benchmark',
    ecosystem: 'Ethereum/EVM',
    category: 'ERC20',
    description: 'Test benchmark for RegressionRunner truthfulness verification',
    targetLanguage: 'solidity',
    framework: 'Foundry/Hardhat',
    complexity: 'Simple',
    basePrompt: 'Create a standard ERC20 token named TestToken with symbol TST and 1000000 initial supply.',
    expectedArtifacts: ['contracts/TestToken.sol'],
    sampleCode: [
      {
        path: 'contracts/TestToken.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
contract TestToken is ERC20 {
    constructor() ERC20("TestToken", "TST") {
        _mint(msg.sender, 1000000 * 10**18);
    }
}`
      }
    ]
  };

  const sampleVariation: PromptVariation = {
    id: 'VAR-01',
    benchmarkId: 'TEST-BENCHMARK-01',
    category: 'Simple',
    promptText: 'Create a standard ERC20 token named TestToken with symbol TST and 1000000 initial supply.',
    expectedBehavior: 'ExpectSuccess',
    metadata: {
      complexityScore: 1,
      rolesCount: 1,
      contractsCount: 1,
      specialDirectives: []
    }
  };

  it('1. Compiler failure is passed as actual failure evidence', () => {
    const status = EngineeringCertificationEngine.collectCompilerResults({
      status: 'FAIL',
      verificationMode: 'REAL_EXECUTION',
      exitCode: 1,
      stdout: '',
      stderr: 'Syntax error',
      language: 'Solidity',
      compilerVersion: '0.8.20',
      durationMs: 10,
      filesCompiled: 0,
      contractsCompiled: 0
    } as any);
    expect(status.passed).toBe(false);
    expect(status.status).toBe('FAIL');
  });

  it('2. Compiler NOT_VERIFIED remains NOT_VERIFIED', () => {
    const status = EngineeringCertificationEngine.collectCompilerResults({
      status: 'NOT_VERIFIED',
      verificationMode: 'TOOLCHAIN_UNAVAILABLE',
      exitCode: null,
      stdout: '',
      stderr: '',
      language: 'Solidity',
      compilerVersion: 'UNKNOWN',
      durationMs: 0,
      filesCompiled: 0,
      contractsCompiled: 0
    } as any);
    expect(status.passed).toBe(false);
    expect(status.status).toBe('NOT_VERIFIED');
  });

  it('3. Testing NOT_VERIFIED remains NOT_VERIFIED', () => {
    const status = EngineeringCertificationEngine.collectTestingResults({
      status: 'NOT_VERIFIED',
      verificationMode: 'TOOLCHAIN_UNAVAILABLE',
      exitStatus: null,
      testingPassed: false,
      stdout: '',
      stderr: '',
      evidence: null,
      coveragePercentage: 0
    } as any);
    expect(status.passed).toBe(false);
    expect(status.status).toBe('NOT_VERIFIED');
  });

  it('4. Missing dependency evidence cannot become PASS', () => {
    const status = EngineeringCertificationEngine.collectDependencyStatus(undefined);
    expect(status.passed).toBe(false);
    expect(status.status).toBe('NOT_VERIFIED');
  });

  it('5. Missing architecture evidence cannot become PASS', () => {
    const status = EngineeringCertificationEngine.collectArchitectureResults(undefined);
    expect(status.passed).toBe(false);
    expect(status.status).toBe('NOT_VERIFIED');
  });

  it('6. Missing deployment evidence cannot become PASS', () => {
    const status = EngineeringCertificationEngine.collectDeploymentResults(undefined);
    expect(status.passed).toBe(false);
    expect(status.status).toBe('NOT_VERIFIED');
  });

  it('7. Missing export evidence cannot become PASS', () => {
    const status = EngineeringCertificationEngine.collectExportResults(undefined);
    expect(status.passed).toBe(false);
    expect(status.status).toBe('NOT_VERIFIED');
  });

  it('8. No hardcoded compilerVersion 0.8.20 is generated when missing', () => {
    const certRes = ExportEngine.certifyExport([], 'TestProject', 'prompt', 'ethereum');
    const manifest = JSON.parse(certRes.manifestJson);
    expect(manifest.compiler).toBe('UNKNOWN');
  });

  it('9. No hardcoded deployment PASS is generated without deployment evidence', () => {
    const certRes = ExportEngine.certifyExport([
      { path: 'deploy/Deploy.s.sol', content: 'contract Deploy {}', language: 'solidity' }
    ], 'TestProject', 'prompt', 'ethereum');
    expect(certRes.validationGatesPassed.deployment).toBe(false);
  });

  it('10. No fabricated validationGatesPassed object is generated without evidence', () => {
    const certRes = ExportEngine.certifyExport([], 'TestProject', 'prompt', 'ethereum');
    expect(certRes.validationGatesPassed.compiler).toBe(false);
    expect(certRes.validationGatesPassed.testing).toBe(false);
    expect(certRes.validationGatesPassed.dependencies).toBe(false);
    expect(certRes.validationGatesPassed.security).toBe(false);
    expect(certRes.validationGatesPassed.architecture).toBe(false);
  });

  it('11. RegressionRunner pipeline executes and propagates real evidence', async () => {
    const run = await RegressionRunner.executePipelineForProject(sampleBenchmark, sampleVariation);
    expect(run.runId).toBeDefined();
    expect(run.stageResults.length).toBeGreaterThan(0);
  });

  it('12. Compilation failure using Hardhat -> error contains actual Hardhat command', async () => {
    const originalSpawn = CompilerEngine.spawnSyncFn;
    CompilerEngine.spawnSyncFn = ((binary: string, args: string[]) => {
      if (args[0] === 'hardhat' && args[1] === 'compile') {
        return { status: 1, stdout: '', stderr: 'Hardhat compile error' };
      }
      return { status: 0, stdout: '1.0.0', stderr: '' };
    }) as any;

    const originalExecute = UniversalPipeline.execute;
    UniversalPipeline.execute = async () => {
      return {
        name: 'HardhatProject',
        description: 'Hardhat test project',
        blockchain: 'ethereum',
        language: 'solidity',
        framework: 'hardhat',
        contractType: 'Token',
        files: [
          { path: 'hardhat.config.js', content: 'module.exports = {};', language: 'javascript' },
          { path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20;', language: 'solidity' }
        ]
      };
    };

    try {
      await AuthoritativePipelineRouter.generate({
        userPrompt: 'build',
        blockchain: 'ethereum',
        framework: 'hardhat',
        language: 'solidity',
        existingFiles: [
          { path: 'hardhat.config.js', content: 'module.exports = {};', language: 'javascript' },
          { path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20;', language: 'solidity' }
        ],
        aiExecutor: async () => ''
      });
      expect.fail('Should have thrown compilation error');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.errorCode).toBe('COMPILATION_FAILED');
      expect(parsed.command).toContain('hardhat compile');
    } finally {
      CompilerEngine.spawnSyncFn = originalSpawn;
      UniversalPipeline.execute = originalExecute;
    }
  });

  it('13. Compilation failure using Anchor -> error contains actual Anchor command', async () => {
    const originalSpawn = CompilerEngine.spawnSyncFn;
    CompilerEngine.spawnSyncFn = ((binary: string, args: string[]) => {
      if (binary === 'anchor' && args[0] === 'build') {
        return { status: 1, stdout: '', stderr: 'Anchor compile error' };
      }
      return { status: 0, stdout: '1.0.0', stderr: '' };
    }) as any;

    const originalExecute = UniversalPipeline.execute;
    UniversalPipeline.execute = async () => {
      return {
        name: 'AnchorProject',
        description: 'Anchor test project',
        blockchain: 'solana',
        language: 'rust',
        framework: 'anchor',
        contractType: 'Token',
        files: [
          { path: 'Anchor.toml', content: '# anchor program', language: 'toml' },
          { path: 'programs/token/src/lib.rs', content: 'use anchor_lang::prelude::*;', language: 'rust' }
        ]
      };
    };

    try {
      await AuthoritativePipelineRouter.generate({
        userPrompt: 'build',
        blockchain: 'solana',
        framework: 'anchor',
        language: 'rust',
        existingFiles: [
          { path: 'Anchor.toml', content: '# anchor program', language: 'toml' },
          { path: 'programs/token/src/lib.rs', content: 'use anchor_lang::prelude::*;', language: 'rust' }
        ],
        aiExecutor: async () => ''
      });
      expect.fail('Should have thrown compilation error');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.errorCode).toBe('COMPILATION_FAILED');
      expect(parsed.command).toContain('anchor build');
    } finally {
      CompilerEngine.spawnSyncFn = originalSpawn;
      UniversalPipeline.execute = originalExecute;
    }
  });

  it('14. Compilation failure using Foundry -> error contains actual Forge command', async () => {
    const originalSpawn = CompilerEngine.spawnSyncFn;
    CompilerEngine.spawnSyncFn = ((binary: string, args: string[]) => {
      if (args[0] === 'build') {
        return { status: 1, stdout: '', stderr: 'Forge compile error' };
      }
      return { status: 0, stdout: '1.0.0', stderr: '' };
    }) as any;

    const originalExecute = UniversalPipeline.execute;
    UniversalPipeline.execute = async () => {
      return {
        name: 'FoundryProject',
        description: 'Foundry test project',
        blockchain: 'ethereum',
        language: 'solidity',
        framework: 'foundry',
        contractType: 'Token',
        files: [
          { path: 'foundry.toml', content: '[profile.default]', language: 'toml' },
          { path: 'src/Token.sol', content: 'pragma solidity ^0.8.20;', language: 'solidity' }
        ]
      };
    };

    try {
      await AuthoritativePipelineRouter.generate({
        userPrompt: 'build',
        blockchain: 'ethereum',
        framework: 'foundry',
        language: 'solidity',
        existingFiles: [
          { path: 'foundry.toml', content: '[profile.default]', language: 'toml' },
          { path: 'src/Token.sol', content: 'pragma solidity ^0.8.20;', language: 'solidity' }
        ],
        aiExecutor: async () => ''
      });
      expect.fail('Should have thrown compilation error');
    } catch (err: any) {
      const parsed = JSON.parse(err.message);
      expect(parsed.errorCode).toBe('COMPILATION_FAILED');
      expect(parsed.command).toContain('forge build');
    } finally {
      CompilerEngine.spawnSyncFn = originalSpawn;
      UniversalPipeline.execute = originalExecute;
    }
  });

  it('15. Router never modifies SafeMath source', () => {
    const rawCode = `pragma solidity ^0.8.20;
import "./SafeMath.sol";
contract Test {
    using SafeMath for uint256;
}`;
    const processed = ResponseParser.extractSource(rawCode, 'contracts/Test.sol');
    expect(processed).toContain('using SafeMath for uint256;');
  });

  it('16. Router never modifies generated Solidity source automatically', () => {
    const rawCode = `pragma solidity ^0.8.20;
contract Test {
    uint256 public value;
}`;
    const processed = ResponseParser.extractSource(rawCode, 'contracts/Test.sol');
    expect(processed).toContain('uint256 public value;');
  });
});
