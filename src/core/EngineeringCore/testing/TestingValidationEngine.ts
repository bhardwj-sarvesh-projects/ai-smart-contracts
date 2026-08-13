import { ProjectFile } from '../../../types';
import { PatchEngine } from '../patch/PatchEngine';
import { sha256 } from '../utils/cryptoFallback';
import module from 'module';

const requireFn = typeof window === 'undefined' ? module.createRequire(import.meta.url) : null;
const fs = requireFn ? requireFn('fs') : null;
const path = requireFn ? requireFn('path') : null;
const os = requireFn ? requireFn('os') : null;
const spawnSync = requireFn ? requireFn('child_process').spawnSync : null;

export type TestingStatus = "PASS" | "FAIL" | "NOT_VERIFIED";
export type VerificationMode = "REAL_EXECUTION" | "TOOLCHAIN_UNAVAILABLE";

export interface TestExecutionEvidence {
  command: string;
  workingDirectory: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  startTimestamp: string;
  endTimestamp: string;
  durationMs: number;
  compilerVersion: string;
  foundryVersion: string;
  workspaceHash: string;
  testFilesDiscovered: string[];
  testFilesExecuted: string[];
  timeout?: number;
  totalTestsDiscovered?: number;
}

export interface TestingValidationResult {
  status: TestingStatus;
  verificationMode: VerificationMode;
  command: string;
  workspace: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;

  testingPassed: boolean;
  score: number | null | "NOT_MEASURED";
  exitStatus: number;
  evidence: TestExecutionEvidence;
  certifiedFiles?: ProjectFile[];
  regressionResult?: any;
  coverageReport?: any;
  structureResult?: any;
  businessRuleResult?: any;
  stateTransitionResult?: any;
  totalTestsDiscovered?: number;
}

export class TestingValidationEngine {
  public static spawnSyncFn = spawnSync;

  public static discoverTests(files: ProjectFile[]): ProjectFile[] {
    return (files || []).filter(f => {
      const p = f.path.toLowerCase();
      return p.includes('test') || p.includes('spec') || p.endsWith('.t.sol') || p.endsWith('.test.ts') || p.endsWith('.spec.ts');
    });
  }

  public static resolveForgePath(): string {
    if (!this.spawnSyncFn) return 'forge';
    const candidatePaths = [
      '/root/.foundry/bin/forge',
      '/usr/local/bin/forge',
      '/usr/bin/forge'
    ];
    for (const cp of candidatePaths) {
      try {
        if (fs && fs.existsSync(cp)) {
          return cp;
        }
      } catch {
        // ignore
      }
    }
    try {
      const testRun = this.spawnSyncFn('forge', ['--version'], { encoding: 'utf8' });
      if (testRun.status === 0) {
        return 'forge';
      }
    } catch {
      // ignore
    }
    return 'forge';
  }

  public static resolveHardhatPath(workspacePath?: string): { binary: string; cmdArgs: string[] } | null {
    if (!this.spawnSyncFn) return null;

    if (fs) {
      const candidatePaths = [
        workspacePath ? path.join(workspacePath, 'node_modules', '.bin', 'hardhat') : '',
        path.join(process.cwd(), 'node_modules', '.bin', 'hardhat'),
        '/usr/local/bin/hardhat',
        '/usr/bin/hardhat'
      ].filter(Boolean);

      for (const cp of candidatePaths) {
        try {
          if (fs.existsSync(cp)) {
            return { binary: cp, cmdArgs: ['test'] };
          }
        } catch {
          // ignore
        }
      }
    }

    // Check if npx --no-install hardhat works without downloading
    try {
      const testRun = this.spawnSyncFn('npx', ['--no-install', 'hardhat', '--version'], { encoding: 'utf8' });
      if (testRun && testRun.status === 0 && !testRun.error && (!testRun.stderr || !testRun.stderr.includes('canceled due to missing packages'))) {
        return { binary: 'npx', cmdArgs: ['--no-install', 'hardhat', 'test'] };
      }
    } catch {
      // ignore
    }

    // Fallback check for mock spawnSyncFn or global hardhat in tests
    try {
      const testRun = this.spawnSyncFn('hardhat', ['--version'], { encoding: 'utf8' });
      if (testRun && testRun.status === 0 && !testRun.error) {
        return { binary: 'hardhat', cmdArgs: ['test'] };
      }
    } catch {
      // ignore
    }

    return null;
  }

  public static certifyTesting(
    files: ProjectFile[],
    projectName: string,
    prompt: string,
    blockchain: string = 'Ethereum/EVM'
  ): TestingValidationResult {
    const startTimestamp = new Date().toISOString();
    const startTime = Date.now();

    const testFiles = this.discoverTests(files);
    const testFilePaths = testFiles.map(f => f.path);
    const workspaceHash = sha256(JSON.stringify(files));

    const tmpBase = os && os.tmpdir ? os.tmpdir() : process.cwd();
    const workspacePath = path.resolve(tmpBase, 'forge_workspace_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));

    // Resolve expected command based on ecosystem
    let expectedCommand = 'forge test';
    let isHardhat = false;
    const lowerBlockchain = (blockchain || '').toLowerCase();

    if (lowerBlockchain.includes('solana')) {
      expectedCommand = 'anchor test';
    } else if (lowerBlockchain.includes('aptos')) {
      expectedCommand = 'aptos move test';
    } else if (lowerBlockchain.includes('sui')) {
      expectedCommand = 'sui move test';
    } else {
      isHardhat = (files || []).some(f => f.path.includes('hardhat.config') || (f.path === 'package.json' && f.content.includes('hardhat')));
      if (isHardhat) {
        expectedCommand = 'npx hardhat test';
      } else {
        expectedCommand = 'forge test';
      }
    }

    let binary = '';
    let cmdArgs: string[] = [];
    let hardhatResolved = false;

    if (expectedCommand === 'npx hardhat test' || isHardhat) {
      const resolved = this.resolveHardhatPath(workspacePath);
      if (resolved) {
        binary = resolved.binary;
        cmdArgs = resolved.cmdArgs;
        hardhatResolved = true;
      } else {
        binary = 'hardhat';
        cmdArgs = ['test'];
        hardhatResolved = false;
      }
    } else if (expectedCommand === 'aptos move test') {
      binary = 'aptos';
      cmdArgs = ['move', 'test'];
    } else if (expectedCommand === 'sui move test') {
      binary = 'sui';
      cmdArgs = ['move', 'test'];
    } else if (expectedCommand === 'anchor test') {
      binary = 'anchor';
      cmdArgs = ['test'];
    } else {
      binary = this.resolveForgePath();
      cmdArgs = ['test'];
    }

    let status: TestingStatus = 'NOT_VERIFIED';
    let verificationMode: VerificationMode = 'REAL_EXECUTION';
    let exitCode: number | null = null;
    let stdout = '';
    let stderr = '';
    let durationMs = 0;

    // Detect if environment/spawning is supported
    if (!this.spawnSyncFn || !fs || !path) {
      status = 'NOT_VERIFIED';
      verificationMode = 'TOOLCHAIN_UNAVAILABLE';
      stderr = 'TEST_RUNNER_UNAVAILABLE: child_process spawnSync or fs unavailable in runtime environment.';
      durationMs = Date.now() - startTime;
      return this.buildResult(
        status,
        verificationMode,
        expectedCommand,
        'N/A',
        startTimestamp,
        new Date().toISOString(),
        durationMs,
        null,
        stdout,
        stderr,
        files,
        testFiles,
        testFilePaths,
        workspaceHash,
        projectName
      );
    }

    // Detect if the specific native tool is available
    let toolAvailable = false;
    if (isHardhat) {
      toolAvailable = hardhatResolved;
    } else {
      try {
        const checkProc = this.spawnSyncFn(binary, ['--version'], { encoding: 'utf8' });
        if (checkProc && checkProc.error === undefined && checkProc.status === 0) {
          toolAvailable = true;
        }
      } catch {
        toolAvailable = false;
      }
    }

    if (!toolAvailable) {
      status = 'NOT_VERIFIED';
      verificationMode = 'TOOLCHAIN_UNAVAILABLE';
      stderr = `TOOL_UNAVAILABLE: Required testing tool "${isHardhat ? 'hardhat' : binary}" is not available in the environment.`;
      durationMs = Date.now() - startTime;
      return this.buildResult(
        status,
        verificationMode,
        expectedCommand,
        workspacePath,
        startTimestamp,
        new Date().toISOString(),
        durationMs,
        null,
        stdout,
        stderr,
        files,
        testFiles,
        testFilePaths,
        workspaceHash,
        projectName
      );
    }

    // Execute actual tests in the isolated workspace
    try {
      if (fs.existsSync(workspacePath)) {
        fs.rmSync(workspacePath, { recursive: true, force: true });
      }
      fs.mkdirSync(workspacePath, { recursive: true });

      (files || []).forEach(f => {
        const normalizedPath = PatchEngine.normalizePath(f.path);
        const fullPath = path.join(workspacePath, normalizedPath);
        const dirPath = path.dirname(fullPath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.writeFileSync(fullPath, f.content, 'utf8');
      });

      console.log(`[TestingValidationEngine] Executing real test command: ${binary} ${cmdArgs.join(' ')}`);
      
      const timeoutMs = 60000;
      const proc = this.spawnSyncFn(binary, cmdArgs, {
        encoding: 'utf8',
        cwd: workspacePath,
        timeout: timeoutMs
      });

      durationMs = Date.now() - startTime;

      if (proc.error) {
        const isTimeout = (proc.error as any).code === 'ETIMEDOUT' || proc.signal === 'SIGTERM' || proc.signal === 'SIGKILL';
        status = 'FAIL';
        exitCode = isTimeout ? 124 : 1;
        stdout = proc.stdout || '';
        stderr = proc.stderr || `PROCESS_ERROR: ${proc.error.message}${isTimeout ? ' (TIMEOUT)' : ''}`;
      } else {
        exitCode = proc.status !== null ? proc.status : 1;
        stdout = proc.stdout || '';
        stderr = proc.stderr || '';
        status = (exitCode === 0) ? 'PASS' : 'FAIL';
      }

      try {
        fs.rmSync(workspacePath, { recursive: true, force: true });
      } catch {
        // ignore cleanup error
      }
    } catch (err: any) {
      status = 'FAIL';
      exitCode = 1;
      stderr = err.message || String(err);
      durationMs = Date.now() - startTime;
    }

    return this.buildResult(
      status,
      verificationMode,
      expectedCommand,
      workspacePath,
      startTimestamp,
      new Date().toISOString(),
      durationMs,
      exitCode,
      stdout,
      stderr,
      files,
      testFiles,
      testFilePaths,
      workspaceHash,
      projectName
    );
  }

  private static buildResult(
    status: TestingStatus,
    verificationMode: VerificationMode,
    command: string,
    workspace: string,
    startedAt: string,
    completedAt: string,
    durationMs: number,
    exitCode: number | null,
    stdout: string,
    stderr: string,
    sanitizedFiles: ProjectFile[],
    testFiles: ProjectFile[],
    testFilePaths: string[],
    workspaceHash: string,
    projectName: string
  ): TestingValidationResult {
    const testingPassed = (status === 'PASS');

    // Calculate static metrics for diagnostic/acceptance tests
    let totalTestsFound = 0;
    testFiles.forEach(tf => {
      const content = tf.content || '';
      const matchesSol = content.match(/function\s+test/g);
      const matchesIt = content.match(/it\s*\(/g);
      const matchesRust = content.match(/#\[test\]/g);
      const matchesMove = content.match(/#\[test/g);
      if (matchesSol) totalTestsFound += matchesSol.length;
      if (matchesIt) totalTestsFound += matchesIt.length;
      if (matchesRust) totalTestsFound += matchesRust.length;
      if (matchesMove) totalTestsFound += matchesMove.length;
    });
    if (totalTestsFound === 0 && testFilePaths.length > 0) {
      totalTestsFound = testFilePaths.length;
    }

    // Build reports for the pipeline check compatibility
    const testReportContent = `# Automated Test Execution Report

**Project Name:** ${projectName}
**Status:** ${status === 'PASS' ? '✅ PASSED' : status === 'NOT_VERIFIED' ? '⚠️ NOT_VERIFIED' : '❌ FAILED'}
**Verification Mode:** ${verificationMode}
**Command:** \`${command}\`
**Duration:** ${durationMs}ms
**Exit Code:** ${exitCode !== null ? exitCode : 'N/A'}

## Test Suites Found
${testFilePaths.length > 0 ? testFilePaths.map(p => `- \`${p}\``).join('\n') : 'No test files discovered.'}

## Execution Output
### stdout
\`\`\`
${stdout || '(empty)'}
\`\`\`

### stderr
\`\`\`
${stderr || '(empty)'}
\`\`\`
`;

    const testCoverageContent = `# Automated Test Coverage Report

**Project Name:** ${projectName}
**Overall Coverage:** NOT_MEASURED

## Code Coverage Breakdown by File
- Coverage was not measured.
`;

    const certifiedFiles = [...sanitizedFiles];
    if (!certifiedFiles.some(f => f.path === 'TEST_REPORT.md')) {
      certifiedFiles.push({ path: 'TEST_REPORT.md', content: testReportContent, language: 'markdown' });
    }
    if (!certifiedFiles.some(f => f.path === 'TEST_COVERAGE.md')) {
      certifiedFiles.push({ path: 'TEST_COVERAGE.md', content: testCoverageContent, language: 'markdown' });
    }

    const evidence: TestExecutionEvidence = {
      command,
      workingDirectory: workspace,
      exitCode,
      stdout,
      stderr,
      startTimestamp: startedAt,
      endTimestamp: completedAt,
      durationMs,
      compilerVersion: 'UNKNOWN',
      foundryVersion: 'unknown',
      workspaceHash,
      testFilesDiscovered: testFilePaths,
      testFilesExecuted: [],
      totalTestsDiscovered: totalTestsFound
    };

    if (exitCode === 124) {
      evidence.timeout = 60000;
    }

    return {
      status,
      verificationMode,
      command,
      workspace,
      startedAt,
      completedAt,
      durationMs,
      exitCode,
      stdout,
      stderr,

      testingPassed,
      score: null,
      exitStatus: exitCode !== null ? exitCode : (status === 'NOT_VERIFIED' ? 127 : 1),
      evidence,
      certifiedFiles,
      totalTestsDiscovered: totalTestsFound,
      regressionResult: {
        passed: testingPassed,
        totalTests: "NOT_MEASURED",
        passCount: "NOT_MEASURED",
        failCount: "NOT_MEASURED",
        testsExecuted: "NOT_MEASURED",
        testsPassed: "NOT_MEASURED",
        testsFailed: "NOT_MEASURED"
      },
      coverageReport: {
        overallCoverage: 'NOT_MEASURED'
      },
      structureResult: {
        totalTestsFound,
        totalTestsDiscovered: totalTestsFound,
        totalTests: "NOT_MEASURED",
        passCount: "NOT_MEASURED",
        failCount: "NOT_MEASURED",
        testsExecuted: "NOT_MEASURED",
        testsPassed: "NOT_MEASURED",
        testsFailed: "NOT_MEASURED"
      },
      businessRuleResult: {
        passed: testingPassed
      },
      stateTransitionResult: {
        passed: testingPassed
      }
    };
  }

  public static validate(files: ProjectFile[], projectName = 'SmartContractProject', prompt = '', blockchain = 'ethereum') {
    return this.certifyTesting(files, projectName, prompt, blockchain);
  }

  public static certify(files: ProjectFile[], projectName = 'SmartContractProject', prompt = '', blockchain = 'ethereum') {
    return this.certifyTesting(files, projectName, prompt, blockchain);
  }
}
