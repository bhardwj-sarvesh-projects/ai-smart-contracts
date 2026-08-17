import { describe, it, expect } from 'vitest';
import { ProjectFile } from '../../../types';
import { EngineeringCertificationEngine, CertificationOptions } from './EngineeringCertificationEngine';
import { CompilationResult } from '../compiler/CompilerEngine';
import { TestingValidationResult } from '../testing/TestingValidationEngine';
import { SecurityAuditResult } from '../security/SecurityAuditEngine';
import { DependencyValidationResult } from '../validators/DependencyValidationEngine';
import { ArchitectureValidationResult } from '../architecture/ArchitectureValidationEngine';
import { ExportCertificationResult, ExportEngine } from '../export/ExportEngine';
import { sha256 } from '../utils/cryptoFallback';

const mockValidFiles: ProjectFile[] = [
  {
    path: 'contracts/Token.sol',
    language: 'solidity',
    content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Token {}'
  },
  {
    path: 'test/Token.t.sol',
    language: 'solidity',
    content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract TokenTest {}'
  },
  {
    path: 'script/Deploy.s.sol',
    language: 'solidity',
    content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract DeployScript {}'
  },
  {
    path: 'README.md',
    language: 'markdown',
    content: '# Token README'
  }
];

const mockFileHashes = {
  "contracts/Token.sol": sha256(mockValidFiles[0].content),
  "test/Token.t.sol": sha256(mockValidFiles[1].content),
  "script/Deploy.s.sol": sha256(mockValidFiles[2].content),
  "README.md": sha256(mockValidFiles[3].content)
};
const mockManifestJson = JSON.stringify({ hashes: mockFileHashes });
const mockManifestHash = sha256(mockManifestJson);
const mockChecksumsTxt = [
  `${mockFileHashes["contracts/Token.sol"]}  contracts/Token.sol`,
  `${mockFileHashes["test/Token.t.sol"]}  test/Token.t.sol`,
  `${mockFileHashes["script/Deploy.s.sol"]}  script/Deploy.s.sol`,
  `${mockFileHashes["README.md"]}  README.md`,
  `${mockManifestHash}  MANIFEST.json`
].join('\n');

const mockFullExportedFiles = [
  ...mockValidFiles,
  { path: 'MANIFEST.json', content: mockManifestJson },
  { path: 'CHECKSUMS.txt', content: mockChecksumsTxt }
];

const mockPassingEvidence: CertificationOptions = {
  compilationResult: {
    status: 'PASS',
    verificationMode: 'REAL_EXECUTION',
    exitCode: 0,
    language: 'Solidity',
    compilerVersion: '0.8.20',
    durationMs: 100,
    stdout: 'Compilation successful',
    stderr: '',
    result: { success: true, errors: [], warnings: [], contracts: [] }
  },
  testingResult: {
    status: 'PASS',
    testingPassed: true,
    verificationMode: 'REAL_EXECUTION',
    exitStatus: 0,
    metrics: { testFilesDiscovered: 1, totalTestsDiscovered: 5, testsExecuted: '5', testsPassed: '5', testsFailed: '0' },
    stdout: '5 tests passed',
    stderr: '',
    evidence: { testRunner: 'forge', durationMs: 200, command: 'forge test' },
    issues: []
  },
  securityAuditResult: {
    isAudited: true,
    overallStatus: 'PASS',
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    findings: [],
    analysisTimestamp: new Date().toISOString()
  },
  dependencyResult: {
    overallStatus: 'PASS',
    projectName: 'Token',
    checks: [{ package: 'forge-std', status: 'PASS', details: 'OK' }],
    warnings: [],
    errors: []
  },
  architectureResult: {
    isValid: true,
    status: 'PASS',
    architecturePassed: true,
    coverageScore: 100,
    mappedRequirementsCount: 5,
    missingRequirementsCount: 0,
    details: 'All requirements mapped',
    requirements: { actors: ['Owner'] } as any,
    comparison: { matchedFeatures: [] } as any,
    scoreBreakdown: { correctnessScore: 100 } as any,
    reportMarkdown: '# Architecture Report'
  },
  documentationResult: {
    passed: true,
    status: 'PASS',
    documentationPassed: true,
    documentationCertified: true,
    reportMarkdown: '# Documentation Report',
    certifiedFiles: mockValidFiles,
    presentDocs: ['README.md']
  },
  deploymentResult: {
    passed: true,
    canDeploy: true,
    status: 'PASS',
    deploymentId: 'DEP-1234',
    state: 'COMPLETED',
    reportMarkdown: '# Deployment Report',
    logs: []
  },
  exportResult: {
    exportCertified: true,
    exportedFiles: mockFullExportedFiles,
    manifestJson: mockManifestJson,
    checksumsTxt: mockChecksumsTxt,
    deliverySummaryMd: '',
    versionTxt: 'v1.0.0',
    reportsPresentCount: 0,
    docsPresentCount: 1,
    diagramsPresentCount: 0,
    validationGatesPassed: {
      workspace: true, integrity: true, dependencies: true, compiler: true,
      security: true, deployment: true, architecture: true, testing: true, documentation: true
    },
    issues: [],
    status: 'PASS'
  }
};

describe('EngineeringCertificationEngine - Fix #4 Authoritative Certification', () => {

  it('TEST 1: Testing toolchain missing (verificationMode TOOLCHAIN_UNAVAILABLE) -> Testing gate NOT_VERIFIED, status NOT_VERIFIED, grade F, delivery blocked', () => {
    const testingResult: TestingValidationResult | any = {
      status: 'NOT_VERIFIED',
      testingPassed: false,
      verificationMode: 'TOOLCHAIN_UNAVAILABLE',
      exitStatus: 127,
      metrics: { testFilesDiscovered: 1, totalTestsDiscovered: 5, testsExecuted: 'NOT_MEASURED', testsPassed: 'NOT_MEASURED', testsFailed: 'NOT_MEASURED' },
      stdout: '',
      stderr: 'forge: command not found',
      issues: ['Toolchain unavailable']
    };

    const options: CertificationOptions = {
      ...mockPassingEvidence,
      testingResult
    };

    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.grade).toBe('F');
    expect(result.executiveSummary).toContain('BLOCKED');
  });

  it('TEST 2: Test runner exit status non-zero (exitStatus 1) -> Testing gate FAIL, status FAILED, grade F, delivery blocked', () => {
    const testingResult: TestingValidationResult | any = {
      status: 'FAIL',
      testingPassed: false,
      verificationMode: 'REAL_EXECUTION',
      exitStatus: 1,
      metrics: { testFilesDiscovered: 1, totalTestsDiscovered: 5, testsExecuted: '5', testsPassed: '4', testsFailed: '1' },
      stdout: '1 test failed',
      stderr: 'Error: assertion failed',
      issues: ['Test failure']
    };

    const options: CertificationOptions = {
      ...mockPassingEvidence,
      testingResult
    };

    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.grade).toBe('F');
  });

  it('TEST 3: Test execution failed -> Testing gate FAIL, delivery blocked', () => {
    const testingResult: TestingValidationResult | any = {
      status: 'FAIL',
      testingPassed: false,
      verificationMode: 'REAL_EXECUTION',
      exitStatus: 1,
      metrics: { testFilesDiscovered: 1, totalTestsDiscovered: 5, testsExecuted: '0', testsPassed: '0', testsFailed: '0' },
      stdout: '',
      stderr: 'Compilation failed before running tests',
      issues: ['No tests executed']
    };

    const options: CertificationOptions = {
      ...mockPassingEvidence,
      testingResult
    };

    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('FAILED');
  });

  it('TEST 4: Compiler toolchain missing or failed -> Compiler gate NOT_VERIFIED or FAIL, certification NOT_VERIFIED/FAILED', () => {
    const compilationResult: CompilationResult | any = {
      status: 'NOT_VERIFIED',
      language: 'Solidity',
      compilerVersion: '0.8.20',
      durationMs: 0,
      stdout: '',
      stderr: 'solc not installed'
    };

    const options: CertificationOptions = {
      ...mockPassingEvidence,
      compilationResult
    };

    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.grade).toBe('F');
  });

  it('TEST 5: Security audit missing -> Security gate NOT_VERIFIED, certification status NOT_VERIFIED', () => {
    const options: CertificationOptions = {
      ...mockPassingEvidence,
      securityAuditResult: undefined
    };

    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.grade).toBe('F');
  });

  it('TEST 6: Security audit detects Critical or High findings -> Security gate FAIL, certification status FAILED', () => {
    const securityAuditResult: SecurityAuditResult | any = {
      isAudited: false,
      overallStatus: 'FAIL',
      criticalCount: 1,
      highCount: 2,
      mediumCount: 0,
      lowCount: 0,
      findings: [
        { severity: 'Critical', title: 'Reentrancy vulnerability' }
      ],
      analysisTimestamp: new Date().toISOString()
    };

    const options: CertificationOptions = {
      ...mockPassingEvidence,
      securityAuditResult
    };

    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('FAILED');
    expect(result.grade).toBe('F');
  });

  it('TEST 7: Source code or project files corrupt/empty/missing -> Workspace/Integrity gate FAIL', () => {
    const emptyFiles: ProjectFile[] = [
      { path: 'contracts/Empty.sol', language: 'solidity', content: '' }
    ];

    const result = EngineeringCertificationEngine.certifyProject(emptyFiles, 'TestProject', 'prompt', 'ethereum', mockPassingEvidence);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('FAILED');
  });

  it('TEST 8: Dependency validation fails -> Dependency gate FAIL, certification status FAILED', () => {
    const dependencyResult: DependencyValidationResult | any = {
      overallStatus: 'FAIL',
      projectName: 'Token',
      checks: [],
      warnings: ['Vulnerable dependency found'],
      errors: ['Version mismatch']
    };

    const options: CertificationOptions = {
      ...mockPassingEvidence,
      dependencyResult
    };

    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('FAILED');
  });

  it('TEST 9: Export gate fails -> Export gate FAIL, status FAILED', () => {
    const exportResult: ExportCertificationResult = {
      exportCertified: false,
      exportedFiles: [],
      manifestJson: '',
      checksumsTxt: '',
      deliverySummaryMd: '',
      versionTxt: '',
      reportsPresentCount: 0,
      docsPresentCount: 0,
      diagramsPresentCount: 0,
      validationGatesPassed: {
        workspace: false, integrity: false, dependencies: false, compiler: false,
        security: false, deployment: false, architecture: false, testing: false, documentation: false
      },
      issues: ['Internal diagnostic files detected in client deliverable'],
      status: 'FAIL'
    };

    const options: CertificationOptions = {
      ...mockPassingEvidence,
      exportResult
    };

    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('FAILED');
  });

  it('TEST 10: All gates pass with valid real execution evidence -> All gates PASS, status CERTIFIED, score 100, grade A+', () => {
    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', mockPassingEvidence);

    expect(result.isCertified).toBe(true);
    expect(result.status).toBe('CERTIFIED');
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A+');
    expect(result.executiveSummary).toContain('CERTIFIED & APPROVED FOR CLIENT DELIVERY');
  });

  it('TEST 11: Missing evidence converts to NOT_VERIFIED (never PASS)', () => {
    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum');

    expect(result.isCertified).toBe(false);
    expect(result.status).toBe('NOT_VERIFIED');
    expect(result.grade).toBe('F');
  });

  it('TEST 12: Certification score is strictly calculated from evidence', () => {
    // Only 2 gates pass (workspace & integrity), 8 missing evidence (score = 20)
    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum');

    expect(result.score).toBe(20);
    expect(result.grade).toBe('F');
  });

  it('TEST 13: Certification output separates client deliverables from internal diagnostics', () => {
    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', mockPassingEvidence);

    expect(result.certifiedFiles.every(f => !f.path.startsWith('.diagnostics/'))).toBe(true);
    expect(result.internalDiagnostics.some(f => f.path.startsWith('.diagnostics/'))).toBe(true);
    expect(result.artifacts.projectFiles).toBeDefined();
    expect(result.artifacts.internalDiagnostics).toBeDefined();
  });

  it('TEST 14: Certification Engine contains NO AI, compiler, test, or security execution calls', () => {
    // Verify certification engine evaluates purely deterministically without throwing or hanging on missing external dependencies
    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum');
    expect(result).toBeDefined();
    expect(typeof result.isCertified).toBe('boolean');
  });

  it('TEST 15: Compiler version is UNKNOWN when absent in evidence (never hardcoded 0.8.20)', () => {
    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum');
    const manifest = JSON.parse(result.evidenceManifestJson);
    expect(manifest.compiler).toBe('UNKNOWN');
  });

  it('TEST 16: Validation timeline durationMs is null when unmeasured (never hardcoded 10ms)', () => {
    const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum');
    const manifest = JSON.parse(result.evidenceManifestJson);
    expect(manifest.validationTimeline.every((t: any) => t.durationMs === null)).toBe(true);
  });

  describe('Fix #4 Hardening Tests', () => {
    it('1. Compiler PASS without exitCode -> NOT_VERIFIED', () => {
      const compilationResult: any = { status: 'PASS', verificationMode: 'REAL_EXECUTION' };
      const res = EngineeringCertificationEngine.collectCompilerResults(compilationResult);
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('2. Compiler PASS without REAL_EXECUTION -> NOT_VERIFIED', () => {
      const compilationResult: any = { status: 'PASS', exitCode: 0, verificationMode: 'SYNTHETIC' };
      const res = EngineeringCertificationEngine.collectCompilerResults(compilationResult);
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('3. Testing PASS without exitStatus -> NOT_VERIFIED', () => {
      const testingResult: any = { status: 'PASS', verificationMode: 'REAL_EXECUTION' };
      const res = EngineeringCertificationEngine.collectTestingResults(testingResult);
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('4. Testing PASS without REAL_EXECUTION -> NOT_VERIFIED', () => {
      const testingResult: any = { status: 'PASS', exitStatus: 0, verificationMode: 'SYNTHETIC' };
      const res = EngineeringCertificationEngine.collectTestingResults(testingResult);
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('5. Missing compiler exitCode -> UNKNOWN exit status', () => {
      const options: CertificationOptions = {
        ...mockPassingEvidence,
        compilationResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION' } as any
      };
      const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);
      const manifest = JSON.parse(result.evidenceManifestJson);
      expect(manifest.executionEvidence.compilerExitStatus).toBe('UNKNOWN');
    });

    it('6. Missing test command -> UNKNOWN, never "forge test"', () => {
      const options: CertificationOptions = {
        ...mockPassingEvidence,
        testingResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitStatus: 0, evidence: {} } as any
      };
      const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);
      const manifest = JSON.parse(result.evidenceManifestJson);
      expect(manifest.executionEvidence.testCommand).toBe('UNKNOWN');
      expect(manifest.executionEvidence.testCommand).not.toBe('forge test');
    });

    it('7. Missing duration -> null in timeline, never 0ms', () => {
      const options: CertificationOptions = {
        ...mockPassingEvidence,
        compilationResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0 } as any,
        testingResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitStatus: 0, evidence: { command: 'forge test' } } as any
      };
      const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);
      const manifest = JSON.parse(result.evidenceManifestJson);
      expect(manifest.validationTimeline.find((t: any) => t.gate.includes('Compiler')).durationMs).toBeNull();
      expect(manifest.validationTimeline.find((t: any) => t.gate.includes('Testing')).durationMs).toBeNull();
    });

    it('8. Architecture { isValid: true } without evidence -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectArchitectureResults({ isValid: true, status: 'PASS' });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('9. Documentation { passed: true } without evidence -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectDocumentationResults({ passed: true, status: 'PASS' });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('10. Deployment { canDeploy: true } without evidence -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectDeploymentResults({ canDeploy: true, status: 'PASS' });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('11. Export { exportCertified: true } without evidence -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({ exportCertified: true, status: 'PASS' });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('12. Real compiler evidence PASS -> PASS', () => {
      const res = EngineeringCertificationEngine.collectCompilerResults({ status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0 } as any);
      expect(res.status).toBe('PASS');
    });

    it('13. Real testing evidence PASS -> PASS', () => {
      const res = EngineeringCertificationEngine.collectTestingResults({ status: 'PASS', verificationMode: 'REAL_EXECUTION', exitStatus: 0 } as any);
      expect(res.status).toBe('PASS');
    });

    it('14. Real deployment evidence PASS -> PASS', () => {
      const res = EngineeringCertificationEngine.collectDeploymentResults({ status: 'PASS', deploymentId: 'DEP-1', state: 'COMPLETED', reportMarkdown: 'OK' });
      expect(res.status).toBe('PASS');
    });

    it('15. Security result overallStatus = FAIL, isAudited = true -> certification FAIL', () => {
      const res = EngineeringCertificationEngine.collectSecurityResults({ overallStatus: 'FAIL', isAudited: true, findings: [], timestamp: '2026-08-12' });
      expect(res.status).toBe('FAIL');
    });

    it('16. Security evidence missing -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectSecurityResults({ overallStatus: 'PASS', isAudited: true });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('17. Architecture boolean without authoritative evidence -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectArchitectureResults({ architecturePassed: true });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('18. Documentation boolean without authoritative evidence -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectDocumentationResults({ documentationPassed: true });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('19. Compiler version missing -> UNKNOWN', () => {
      const options: CertificationOptions = {
        ...mockPassingEvidence,
        compilationResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0 } as any
      };
      const result = EngineeringCertificationEngine.certifyProject(mockValidFiles, 'TestProject', 'prompt', 'ethereum', options);
      const manifest = JSON.parse(result.evidenceManifestJson);
      expect(manifest.executionEvidence.compilerVersion).toBe('UNKNOWN');
    });

    it('TEST 1: exportCertified: true alone -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({ exportCertified: true });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 2: exportCertified: true, status: "PASS" alone -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({ exportCertified: true, status: 'PASS' });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 3: PASS + complete files + manifest + checksums + empty validationGatesPassed -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: '{}',
        checksumsTxt: 'hash123',
        validationGatesPassed: {}
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 4: PASS + complete evidence + partial validationGatesPassed -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: '{}',
        checksumsTxt: 'hash123',
        validationGatesPassed: {
          workspace: true,
          integrity: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 5: PASS + complete evidence + compiler=false -> FAIL or NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: '{}',
        checksumsTxt: 'hash123',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: false,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status === 'FAIL' || res.status === 'NOT_VERIFIED').toBe(true);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 6: PASS + complete evidence + testing=false -> FAIL or NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: '{}',
        checksumsTxt: 'hash123',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: false,
          documentation: true
        }
      });
      expect(res.status === 'FAIL' || res.status === 'NOT_VERIFIED').toBe(true);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 7: PASS + complete evidence + security=false -> FAIL or NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: '{}',
        checksumsTxt: 'hash123',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: false,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status === 'FAIL' || res.status === 'NOT_VERIFIED').toBe(true);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 8: PASS + complete evidence + deployment=false -> FAIL or NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: false,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status === 'FAIL' || res.status === 'NOT_VERIFIED').toBe(true);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 9: PASS + complete evidence + all required gates=true -> PASS', () => {
      const content = 'contract Token {}';
      const fileHash = sha256(content);
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": fileHash } });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${fileHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [
          { path: 'contracts/Token.sol', content },
          { path: 'MANIFEST.json', content: manifestJson },
          { path: 'CHECKSUMS.txt', content: checksumsTxt }
        ],
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('PASS');
    });

    it('TEST 10: FAIL + complete evidence -> FAIL', () => {
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } });
      const checksumsTxt = 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol\n45bc34f6bb9cdde8ee794ea8e7eeb3fc3430ee81414e2d3129853ebc837aafe0  MANIFEST.json';
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'FAIL',
        exportCertified: true,
        exportedFiles: [
          { path: 'contracts/Token.sol', content: 'contract Token {}' },
          { path: 'MANIFEST.json', content: manifestJson },
          { path: 'CHECKSUMS.txt', content: checksumsTxt }
        ],
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('FAIL');
    });

    it('TEST 11: NOT_VERIFIED + complete evidence -> NOT_VERIFIED', () => {
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } });
      const checksumsTxt = 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol\n45bc34f6bb9cdde8ee794ea8e7eeb3fc3430ee81414e2d3129853ebc837aafe0  MANIFEST.json';
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'NOT_VERIFIED',
        exportCertified: true,
        exportedFiles: [
          { path: 'contracts/Token.sol', content: 'contract Token {}' },
          { path: 'MANIFEST.json', content: manifestJson },
          { path: 'CHECKSUMS.txt', content: checksumsTxt }
        ],
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 12: Missing status -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 13: Gate value "true" string -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: 'true',
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 14: Gate value null -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: null,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 15: Gate value undefined -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: undefined,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 16: Extra unknown gate fields must not cause PASS if required gates are missing', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          someOtherGate: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 17: manifestJson = "{}" exportedFiles contains real files -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: '{}',
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 18: manifest contains a file that does not exist in exportedFiles -> NOT_VERIFIED or FAIL', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({
          hashes: {
            "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8",
            "contracts/NonExistent.sol": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
          }
        }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status === 'NOT_VERIFIED' || res.status === 'FAIL').toBe(true);
    });

    it('TEST 19: exportedFiles contains a file missing from manifest -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [
          { path: 'contracts/Token.sol', content: 'contract Token {}' },
          { path: 'contracts/Missing.sol', content: 'contract Missing {}' }
        ],
        manifestJson: JSON.stringify({
          hashes: {
            "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8"
          }
        }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 20: checksumsTxt contains an incorrect SHA-256 hash -> FAIL', () => {
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } });
      const checksumsTxt = '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef  contracts/Token.sol\n45bc34f6bb9cdde8ee794ea8e7eeb3fc3430ee81414e2d3129853ebc837aafe0  MANIFEST.json';
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [
          { path: 'contracts/Token.sol', content: 'contract Token {}' },
          { path: 'MANIFEST.json', content: manifestJson },
          { path: 'CHECKSUMS.txt', content: checksumsTxt }
        ],
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('FAIL');
    });

    it('TEST 21: checksumsTxt is missing a file checksum -> NOT_VERIFIED', () => {
      const tokenHash = sha256('contract Token {}');
      const otherHash = sha256('contract Other {}');
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [
          { path: 'contracts/Token.sol', content: 'contract Token {}' },
          { path: 'contracts/Other.sol', content: 'contract Other {}' }
        ],
        manifestJson: JSON.stringify({
          hashes: {
            "contracts/Token.sol": tokenHash,
            "contracts/Other.sol": otherHash
          }
        }),
        checksumsTxt: `${tokenHash}  contracts/Token.sol`,
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 22: checksumsTxt contains duplicate entries -> NOT_VERIFIED', () => {
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol\ne46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      });
      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 23: actual compiler gate = FAIL, export validationGatesPassed.compiler = true -> Export Certification != PASS', () => {
      const authGates = {
        workspace: { name: 'Workspace', status: 'PASS', passed: true, score: 100, details: '' },
        integrity: { name: 'Integrity', status: 'PASS', passed: true, score: 100, details: '' },
        dependencies: { name: 'Dependencies', status: 'PASS', passed: true, score: 100, details: '' },
        compiler: { name: 'Compiler', status: 'FAIL', passed: false, score: 0, details: '' },
        security: { name: 'Security', status: 'PASS', passed: true, score: 100, details: '' },
        deployment: { name: 'Deployment', status: 'PASS', passed: true, score: 100, details: '' },
        architecture: { name: 'Architecture', status: 'PASS', passed: true, score: 100, details: '' },
        testing: { name: 'Testing', status: 'PASS', passed: true, score: 100, details: '' },
        documentation: { name: 'Documentation', status: 'PASS', passed: true, score: 100, details: '' }
      };
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      }, authGates);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 24: actual compiler gate = NOT_VERIFIED, export validationGatesPassed.compiler = true -> Export Certification != PASS', () => {
      const authGates = {
        workspace: { name: 'Workspace', status: 'PASS', passed: true, score: 100, details: '' },
        integrity: { name: 'Integrity', status: 'PASS', passed: true, score: 100, details: '' },
        dependencies: { name: 'Dependencies', status: 'PASS', passed: true, score: 100, details: '' },
        compiler: { name: 'Compiler', status: 'NOT_VERIFIED', passed: false, score: 0, details: '' },
        security: { name: 'Security', status: 'PASS', passed: true, score: 100, details: '' },
        deployment: { name: 'Deployment', status: 'PASS', passed: true, score: 100, details: '' },
        architecture: { name: 'Architecture', status: 'PASS', passed: true, score: 100, details: '' },
        testing: { name: 'Testing', status: 'PASS', passed: true, score: 100, details: '' },
        documentation: { name: 'Documentation', status: 'PASS', passed: true, score: 100, details: '' }
      };
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      }, authGates);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 25: actual testing gate = FAIL, export validationGatesPassed.testing = true -> Export Certification != PASS', () => {
      const authGates = {
        workspace: { name: 'Workspace', status: 'PASS', passed: true, score: 100, details: '' },
        integrity: { name: 'Integrity', status: 'PASS', passed: true, score: 100, details: '' },
        dependencies: { name: 'Dependencies', status: 'PASS', passed: true, score: 100, details: '' },
        compiler: { name: 'Compiler', status: 'PASS', passed: true, score: 100, details: '' },
        security: { name: 'Security', status: 'PASS', passed: true, score: 100, details: '' },
        deployment: { name: 'Deployment', status: 'PASS', passed: true, score: 100, details: '' },
        architecture: { name: 'Architecture', status: 'PASS', passed: true, score: 100, details: '' },
        testing: { name: 'Testing', status: 'FAIL', passed: false, score: 0, details: '' },
        documentation: { name: 'Documentation', status: 'PASS', passed: true, score: 100, details: '' }
      };
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      }, authGates);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 26: actual security gate = FAIL, export validationGatesPassed.security = true -> Export Certification != PASS', () => {
      const authGates = {
        workspace: { name: 'Workspace', status: 'PASS', passed: true, score: 100, details: '' },
        integrity: { name: 'Integrity', status: 'PASS', passed: true, score: 100, details: '' },
        dependencies: { name: 'Dependencies', status: 'PASS', passed: true, score: 100, details: '' },
        compiler: { name: 'Compiler', status: 'PASS', passed: true, score: 100, details: '' },
        security: { name: 'Security', status: 'FAIL', passed: false, score: 0, details: '' },
        deployment: { name: 'Deployment', status: 'PASS', passed: true, score: 100, details: '' },
        architecture: { name: 'Architecture', status: 'PASS', passed: true, score: 100, details: '' },
        testing: { name: 'Testing', status: 'PASS', passed: true, score: 100, details: '' },
        documentation: { name: 'Documentation', status: 'PASS', passed: true, score: 100, details: '' }
      };
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      }, authGates);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 27: actual architecture gate = FAIL, export validationGatesPassed.architecture = true -> Export Certification != PASS', () => {
      const authGates = {
        workspace: { name: 'Workspace', status: 'PASS', passed: true, score: 100, details: '' },
        integrity: { name: 'Integrity', status: 'PASS', passed: true, score: 100, details: '' },
        dependencies: { name: 'Dependencies', status: 'PASS', passed: true, score: 100, details: '' },
        compiler: { name: 'Compiler', status: 'PASS', passed: true, score: 100, details: '' },
        security: { name: 'Security', status: 'PASS', passed: true, score: 100, details: '' },
        deployment: { name: 'Deployment', status: 'PASS', passed: true, score: 100, details: '' },
        architecture: { name: 'Architecture', status: 'FAIL', passed: false, score: 0, details: '' },
        testing: { name: 'Testing', status: 'PASS', passed: true, score: 100, details: '' },
        documentation: { name: 'Documentation', status: 'PASS', passed: true, score: 100, details: '' }
      };
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [{ path: 'contracts/Token.sol', content: 'contract Token {}' }],
        manifestJson: JSON.stringify({ hashes: { "contracts/Token.sol": "e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8" } }),
        checksumsTxt: 'e46091d1e1289881f57929fc0aed3855eb38bfc76480516fe5ecd2521e17d4f8  contracts/Token.sol',
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      }, authGates);
      expect(res.status).not.toBe('PASS');
    });

    it('TEST 28: all authoritative gates PASS, export validationGatesPassed exactly matches them, manifest matches files, checksums match files -> PASS', () => {
      const authGates = {
        workspace: { name: 'Workspace', status: 'PASS', passed: true, score: 100, details: '' },
        integrity: { name: 'Integrity', status: 'PASS', passed: true, score: 100, details: '' },
        dependencies: { name: 'Dependencies', status: 'PASS', passed: true, score: 100, details: '' },
        compiler: { name: 'Compiler', status: 'PASS', passed: true, score: 100, details: '' },
        security: { name: 'Security', status: 'PASS', passed: true, score: 100, details: '' },
        deployment: { name: 'Deployment', status: 'PASS', passed: true, score: 100, details: '' },
        architecture: { name: 'Architecture', status: 'PASS', passed: true, score: 100, details: '' },
        testing: { name: 'Testing', status: 'PASS', passed: true, score: 100, details: '' },
        documentation: { name: 'Documentation', status: 'PASS', passed: true, score: 100, details: '' }
      };
      const content = 'contract Token {}';
      const fileHash = sha256(content);
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": fileHash } });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${fileHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles: [
          { path: 'contracts/Token.sol', content },
          { path: 'MANIFEST.json', content: manifestJson },
          { path: 'CHECKSUMS.txt', content: checksumsTxt }
        ],
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true,
          integrity: true,
          dependencies: true,
          compiler: true,
          security: true,
          deployment: true,
          architecture: true,
          testing: true,
          documentation: true
        }
      }, authGates);
      expect(res.status).toBe('PASS');
    });
  });

  describe('Fix #4 Final - Manifest SHA-256 Authenticity & Integrity Tests', () => {
    const authGatesPass = {
      workspace: { name: 'Workspace', status: 'PASS', passed: true, score: 100, details: '' },
      integrity: { name: 'Integrity', status: 'PASS', passed: true, score: 100, details: '' },
      dependencies: { name: 'Dependencies', status: 'PASS', passed: true, score: 100, details: '' },
      compiler: { name: 'Compiler', status: 'PASS', passed: true, score: 100, details: '' },
      security: { name: 'Security', status: 'PASS', passed: true, score: 100, details: '' },
      deployment: { name: 'Deployment', status: 'PASS', passed: true, score: 100, details: '' },
      architecture: { name: 'Architecture', status: 'PASS', passed: true, score: 100, details: '' },
      testing: { name: 'Testing', status: 'PASS', passed: true, score: 100, details: '' },
      documentation: { name: 'Documentation', status: 'PASS', passed: true, score: 100, details: '' }
    };

    it('TEST 1 — VALID MANIFEST HASH passes manifest validation', () => {
      const content = 'contract Token {}';
      const fileHash = sha256(content);
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": fileHash } });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${fileHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const exportedFiles = [
        { path: 'contracts/Token.sol', content },
        { path: 'MANIFEST.json', content: manifestJson },
        { path: 'CHECKSUMS.txt', content: checksumsTxt }
      ];

      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles,
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true, integrity: true, dependencies: true, compiler: true,
          security: true, deployment: true, architecture: true, testing: true, documentation: true
        }
      }, authGatesPass);

      expect(res.status).toBe('PASS');
    });

    it('TEST 2 — WRONG MANIFEST HASH returns FAIL', () => {
      const content = 'contract Token {}';
      const realHash = sha256(content);
      const wrongHash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": wrongHash } });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${realHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const exportedFiles = [
        { path: 'contracts/Token.sol', content },
        { path: 'MANIFEST.json', content: manifestJson },
        { path: 'CHECKSUMS.txt', content: checksumsTxt }
      ];

      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles,
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true, integrity: true, dependencies: true, compiler: true,
          security: true, deployment: true, architecture: true, testing: true, documentation: true
        }
      }, authGatesPass);

      expect(res.status).toBe('FAIL');
      expect(res.details).toContain('Manifest hash mismatch');
    });

    it('TEST 3 — INVALID HASH FORMAT returns NOT_VERIFIED', () => {
      const content = 'contract Token {}';
      const realHash = sha256(content);
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": "12345" } });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${realHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const exportedFiles = [
        { path: 'contracts/Token.sol', content },
        { path: 'MANIFEST.json', content: manifestJson },
        { path: 'CHECKSUMS.txt', content: checksumsTxt }
      ];

      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles,
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true, integrity: true, dependencies: true, compiler: true,
          security: true, deployment: true, architecture: true, testing: true, documentation: true
        }
      }, authGatesPass);

      expect(res.status).toBe('NOT_VERIFIED');
      expect(res.details).toContain('invalid');
    });

    it('TEST 4 — MISSING MANIFEST HASH returns NOT_VERIFIED', () => {
      const content = 'contract Token {}';
      const realHash = sha256(content);
      const manifestJson = JSON.stringify({ hashes: {} });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${realHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const exportedFiles = [
        { path: 'contracts/Token.sol', content },
        { path: 'MANIFEST.json', content: manifestJson },
        { path: 'CHECKSUMS.txt', content: checksumsTxt }
      ];

      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles,
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true, integrity: true, dependencies: true, compiler: true,
          security: true, deployment: true, architecture: true, testing: true, documentation: true
        }
      }, authGatesPass);

      expect(res.status).toBe('NOT_VERIFIED');
      expect(res.details).toContain('Integrity verification mismatch');
    });

    it('TEST 5 — EXTRA MANIFEST HASH returns NOT_VERIFIED', () => {
      const content = 'contract Token {}';
      const realHash = sha256(content);
      const manifestJson = JSON.stringify({
        hashes: {
          "contracts/Token.sol": realHash,
          "contracts/DoesNotExist.sol": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
        }
      });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${realHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const exportedFiles = [
        { path: 'contracts/Token.sol', content },
        { path: 'MANIFEST.json', content: manifestJson },
        { path: 'CHECKSUMS.txt', content: checksumsTxt }
      ];

      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles,
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true, integrity: true, dependencies: true, compiler: true,
          security: true, deployment: true, architecture: true, testing: true, documentation: true
        }
      }, authGatesPass);

      expect(res.status).toBe('NOT_VERIFIED');
    });

    it('TEST 6 — MANIFEST SELF HASH returns NOT_VERIFIED or FAIL', () => {
      const content = 'contract Token {}';
      const realHash = sha256(content);
      const manifestJson = JSON.stringify({
        hashes: {
          "contracts/Token.sol": realHash,
          "MANIFEST.json": "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
        }
      });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${realHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const exportedFiles = [
        { path: 'contracts/Token.sol', content },
        { path: 'MANIFEST.json', content: manifestJson },
        { path: 'CHECKSUMS.txt', content: checksumsTxt }
      ];

      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles,
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true, integrity: true, dependencies: true, compiler: true,
          security: true, deployment: true, architecture: true, testing: true, documentation: true
        }
      }, authGatesPass);

      expect(['NOT_VERIFIED', 'FAIL']).toContain(res.status);
    });

    it('TEST 7 — CHECKSUMS SELF HASH returns NOT_VERIFIED or FAIL', () => {
      const content = 'contract Token {}';
      const realHash = sha256(content);
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": realHash } });
      const checksumsTxt = `${realHash}  contracts/Token.sol\ndddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd  CHECKSUMS.txt`;
      const exportedFiles = [
        { path: 'contracts/Token.sol', content },
        { path: 'MANIFEST.json', content: manifestJson },
        { path: 'CHECKSUMS.txt', content: checksumsTxt }
      ];

      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles,
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true, integrity: true, dependencies: true, compiler: true,
          security: true, deployment: true, architecture: true, testing: true, documentation: true
        }
      }, authGatesPass);

      expect(['NOT_VERIFIED', 'FAIL']).toContain(res.status);
    });

    it('TEST 8 — MANIFEST HASH + CHECKSUM HASH BOTH VALID passes', () => {
      const content = 'contract Token {}';
      const realHash = sha256(content);
      const manifestJson = JSON.stringify({ hashes: { "contracts/Token.sol": realHash } });
      const manifestHash = sha256(manifestJson);
      const checksumsTxt = `${realHash}  contracts/Token.sol\n${manifestHash}  MANIFEST.json`;
      const exportedFiles = [
        { path: 'contracts/Token.sol', content },
        { path: 'MANIFEST.json', content: manifestJson },
        { path: 'CHECKSUMS.txt', content: checksumsTxt }
      ];

      const res = EngineeringCertificationEngine.collectExportResults({
        status: 'PASS',
        exportCertified: true,
        exportedFiles,
        manifestJson,
        checksumsTxt,
        validationGatesPassed: {
          workspace: true, integrity: true, dependencies: true, compiler: true,
          security: true, deployment: true, architecture: true, testing: true, documentation: true
        }
      }, authGatesPass);

      expect(res.status).toBe('PASS');
    });

    it('TEST 9 — END-TO-END TEST: ExportEngine.certifyExport -> EngineeringCertificationEngine.certifyProject', () => {
      const files: ProjectFile[] = [
        { path: 'contracts/Token.sol', language: 'solidity', content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Token {}' },
        { path: 'README.md', language: 'markdown', content: '# Token' },
        { path: 'ARCHITECTURE.md', language: 'markdown', content: '# Architecture' },
        { path: 'SECURITY.md', language: 'markdown', content: '# Security' },
        { path: 'DEPLOYMENT.md', language: 'markdown', content: '# Deployment' },
        { path: 'API_REFERENCE.md', language: 'markdown', content: '# API Reference' },
        { path: 'CLIENT_HANDOVER.md', language: 'markdown', content: '# Handover' },
        { path: 'DEVELOPER_GUIDE.md', language: 'markdown', content: '# Dev Guide' },
        { path: 'TESTING_GUIDE.md', language: 'markdown', content: '# Testing Guide' },
        { path: 'CHANGELOG.md', language: 'markdown', content: '# Changelog' },
        { path: 'LICENSE', language: 'text', content: 'MIT' },
        { path: 'KNOWLEDGE_INDEX.md', language: 'markdown', content: '# Knowledge Index' },
        { path: 'script/Deploy.s.sol', language: 'solidity', content: 'contract Deploy {}' }
      ];

      const exportResult = ExportEngine.certifyExport(files, 'TokenProject', 'build token', 'ethereum', 'Foundry', {
        compilationResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0 },
        testingResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitStatus: 0 },
        securityAuditResult: { criticalCount: 0, highCount: 0, overallStatus: 'PASS' },
        dependencyResult: { overallStatus: 'PASS' },
        architectureResult: { architecturePassed: true, requirements: {} },
        documentationResult: { documentationPassed: true, reportMarkdown: 'doc' },
        deploymentResult: { deploymentId: 'DEP-1', state: 'COMPLETED', status: 'PASS' }
      });

      expect(exportResult.status).toBe('PASS');
      expect(exportResult.exportCertified).toBe(true);

      const options: CertificationOptions = {
        compilationResult: {
          status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0,
          language: 'Solidity', compilerVersion: '0.8.20', durationMs: 10, stdout: '', stderr: '',
          result: { success: true, errors: [], warnings: [], contracts: [] }
        },
        testingResult: {
          status: 'PASS', testingPassed: true, verificationMode: 'REAL_EXECUTION', exitStatus: 0,
          metrics: { testFilesDiscovered: 1, totalTestsDiscovered: 1, testsExecuted: '1', testsPassed: '1', testsFailed: '0' },
          stdout: '', stderr: '', evidence: { testRunner: 'forge', durationMs: 10, command: 'forge test' }, issues: []
        },
        securityAuditResult: {
          isAudited: true, overallStatus: 'PASS', criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, findings: [], analysisTimestamp: new Date().toISOString()
        },
        dependencyResult: {
          overallStatus: 'PASS', projectName: 'TokenProject', checks: [], warnings: [], errors: []
        },
        architectureResult: {
          isValid: true, status: 'PASS', architecturePassed: true, coverageScore: 100, mappedRequirementsCount: 1, missingRequirementsCount: 0, details: '', reportMarkdown: 'report', requirements: {}, comparison: {}, scoreBreakdown: {}
        },
        documentationResult: {
          passed: true, status: 'PASS', documentationPassed: true, documentationCertified: true, reportMarkdown: 'doc', certifiedFiles: files, presentDocs: []
        },
        deploymentResult: {
          passed: true, canDeploy: true, status: 'PASS', deploymentId: 'DEP-1', state: 'COMPLETED', reportMarkdown: 'dep', logs: []
        },
        exportResult
      };

      const finalCert = EngineeringCertificationEngine.certifyProject(files, 'TokenProject', 'prompt', 'ethereum', options);

      expect(finalCert.status).toBe('CERTIFIED');
      expect(finalCert.isCertified).toBe(true);
      expect(['A', 'A+']).toContain(finalCert.grade);
    });

    it('TEST 10 — TAMPER TEST: modifying source file content keeping old manifest hash causes FAIL', () => {
      const files: ProjectFile[] = [
        { path: 'contracts/Token.sol', language: 'solidity', content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Token {}' },
        { path: 'README.md', language: 'markdown', content: '# Token' },
        { path: 'ARCHITECTURE.md', language: 'markdown', content: '# Architecture' },
        { path: 'SECURITY.md', language: 'markdown', content: '# Security' },
        { path: 'DEPLOYMENT.md', language: 'markdown', content: '# Deployment' },
        { path: 'API_REFERENCE.md', language: 'markdown', content: '# API Reference' },
        { path: 'CLIENT_HANDOVER.md', language: 'markdown', content: '# Handover' },
        { path: 'DEVELOPER_GUIDE.md', language: 'markdown', content: '# Dev Guide' },
        { path: 'TESTING_GUIDE.md', language: 'markdown', content: '# Testing Guide' },
        { path: 'CHANGELOG.md', language: 'markdown', content: '# Changelog' },
        { path: 'LICENSE', language: 'text', content: 'MIT' },
        { path: 'KNOWLEDGE_INDEX.md', language: 'markdown', content: '# Knowledge Index' },
        { path: 'script/Deploy.s.sol', language: 'solidity', content: 'contract Deploy {}' }
      ];

      const exportResult = ExportEngine.certifyExport(files, 'TokenProject', 'prompt', 'ethereum', 'Foundry', {
        compilationResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0 },
        testingResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitStatus: 0 },
        securityAuditResult: { criticalCount: 0, highCount: 0, overallStatus: 'PASS' },
        dependencyResult: { overallStatus: 'PASS' },
        architectureResult: { architecturePassed: true, requirements: {} },
        documentationResult: { documentationPassed: true, reportMarkdown: 'doc' },
        deploymentResult: { deploymentId: 'DEP-1', state: 'COMPLETED', status: 'PASS' }
      });

      // Tamper: modify content of contracts/Token.sol in exportedFiles, leaving manifestJson unchanged
      const tamperedFiles = exportResult.exportedFiles.map(f => {
        if (f.path === 'contracts/Token.sol') {
          return { ...f, content: '// TAMPERED CONTRACT CONTENT' };
        }
        return f;
      });

      const tamperedExportResult = {
        ...exportResult,
        exportedFiles: tamperedFiles
      };

      const options: CertificationOptions = {
        compilationResult: {
          status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0,
          language: 'Solidity', compilerVersion: '0.8.20', durationMs: 10, stdout: '', stderr: '',
          result: { success: true, errors: [], warnings: [], contracts: [] }
        },
        testingResult: {
          status: 'PASS', testingPassed: true, verificationMode: 'REAL_EXECUTION', exitStatus: 0,
          metrics: { testFilesDiscovered: 1, totalTestsDiscovered: 1, testsExecuted: '1', testsPassed: '1', testsFailed: '0' },
          stdout: '', stderr: '', evidence: { testRunner: 'forge', durationMs: 10, command: 'forge test' }, issues: []
        },
        securityAuditResult: {
          isAudited: true, overallStatus: 'PASS', criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, findings: [], analysisTimestamp: new Date().toISOString()
        },
        dependencyResult: {
          overallStatus: 'PASS', projectName: 'TokenProject', checks: [], warnings: [], errors: []
        },
        architectureResult: {
          isValid: true, status: 'PASS', architecturePassed: true, coverageScore: 100, mappedRequirementsCount: 1, missingRequirementsCount: 0, details: '', reportMarkdown: 'report', requirements: {}, comparison: {}, scoreBreakdown: {}
        },
        documentationResult: {
          passed: true, status: 'PASS', documentationPassed: true, documentationCertified: true, reportMarkdown: 'doc', certifiedFiles: files, presentDocs: []
        },
        deploymentResult: {
          passed: true, canDeploy: true, status: 'PASS', deploymentId: 'DEP-1', state: 'COMPLETED', reportMarkdown: 'dep', logs: []
        },
        exportResult: tamperedExportResult
      };

      const finalCert = EngineeringCertificationEngine.certifyProject(files, 'TokenProject', 'prompt', 'ethereum', options);

      expect(finalCert.isCertified).toBe(false);
      expect(finalCert.status).toBe('FAILED');
    });
  });

  describe('Fix #4 Mandatory Consistency Lock Tests 1-12', () => {
    const validProjectFiles: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Token {}' },
      { path: 'README.md', language: 'markdown', content: '# Token' },
      { path: 'ARCHITECTURE.md', language: 'markdown', content: '# Architecture' },
      { path: 'SECURITY.md', language: 'markdown', content: '# Security' },
      { path: 'DEPLOYMENT.md', language: 'markdown', content: '# Deployment' },
      { path: 'API_REFERENCE.md', language: 'markdown', content: '# API Reference' },
      { path: 'CLIENT_HANDOVER.md', language: 'markdown', content: '# Handover' },
      { path: 'DEVELOPER_GUIDE.md', language: 'markdown', content: '# Dev Guide' },
      { path: 'TESTING_GUIDE.md', language: 'markdown', content: '# Testing Guide' },
      { path: 'CHANGELOG.md', language: 'markdown', content: '# Changelog' },
      { path: 'LICENSE', language: 'text', content: 'MIT' },
      { path: 'KNOWLEDGE_INDEX.md', language: 'markdown', content: '# Knowledge Index' }
    ];

    function createValidRealExport() {
      return ExportEngine.certifyExport(validProjectFiles, 'TokenProject', 'prompt', 'ethereum', 'Foundry', {
        compilationResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0 },
        testingResult: { status: 'PASS', verificationMode: 'REAL_EXECUTION', exitStatus: 0 },
        securityAuditResult: { criticalCount: 0, highCount: 0, overallStatus: 'PASS' },
        dependencyResult: { overallStatus: 'PASS' },
        architectureResult: { architecturePassed: true, requirements: {} },
        documentationResult: { documentationPassed: true, reportMarkdown: 'doc' },
        deploymentResult: { deploymentId: 'DEP-1', state: 'COMPLETED', status: 'PASS' }
      });
    }

    const authGatesPass = {
      workspace: { name: 'Workspace', status: 'PASS', passed: true, score: 100, details: '' },
      integrity: { name: 'Integrity', status: 'PASS', passed: true, score: 100, details: '' },
      dependencies: { name: 'Dependencies', status: 'PASS', passed: true, score: 100, details: '' },
      compiler: { name: 'Compiler', status: 'PASS', passed: true, score: 100, details: '' },
      security: { name: 'Security', status: 'PASS', passed: true, score: 100, details: '' },
      deployment: { name: 'Deployment', status: 'PASS', passed: true, score: 100, details: '' },
      architecture: { name: 'Architecture', status: 'PASS', passed: true, score: 100, details: '' },
      testing: { name: 'Testing', status: 'PASS', passed: true, score: 100, details: '' },
      documentation: { name: 'Documentation', status: 'PASS', passed: true, score: 100, details: '' }
    };

    it('MANDATORY TEST 1 — ACTUAL MANIFEST MATCH', () => {
      const exportResult = createValidRealExport();
      const actualManifest = exportResult.exportedFiles.find(f => f.path === 'MANIFEST.json');
      expect(actualManifest).toBeDefined();
      expect(exportResult.manifestJson).toBe(actualManifest?.content);
      const res = EngineeringCertificationEngine.collectExportResults(exportResult, authGatesPass);
      expect(res.status).toBe('PASS');
    });

    it('MANDATORY TEST 2 — MANIFEST REPRESENTATION TAMPER', () => {
      const exportResult = createValidRealExport();
      const tamperedExport = { ...exportResult, manifestJson: '{"hashes": {}}' };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('FAIL');
      expect(res.details).toContain('MANIFEST.json file content in exportedFiles does not match exportResult.manifestJson');
    });

    it('MANDATORY TEST 3 — ACTUAL CHECKSUM FILE MATCH', () => {
      const exportResult = createValidRealExport();
      const actualChecksums = exportResult.exportedFiles.find(f => f.path === 'CHECKSUMS.txt');
      expect(actualChecksums).toBeDefined();
      expect(exportResult.checksumsTxt).toBe(actualChecksums?.content);
      const res = EngineeringCertificationEngine.collectExportResults(authGatesPass ? exportResult : exportResult, authGatesPass);
      expect(res.status).toBe('PASS');
    });

    it('MANDATORY TEST 4 — CHECKSUM REPRESENTATION TAMPER', () => {
      const exportResult = createValidRealExport();
      const tamperedExport = { ...exportResult, checksumsTxt: 'tampered checksum content' };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('FAIL');
      expect(res.details).toContain('CHECKSUMS.txt file content in exportedFiles does not match exportResult.checksumsTxt');
    });

    it('MANDATORY TEST 5 — MISSING MANIFEST FILE', () => {
      const exportResult = createValidRealExport();
      const tamperedFiles = exportResult.exportedFiles.filter(f => f.path !== 'MANIFEST.json');
      const tamperedExport = { ...exportResult, exportedFiles: tamperedFiles };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('NOT_VERIFIED');
      expect(res.details).toContain('Missing MANIFEST.json');
    });

    it('MANDATORY TEST 6 — MISSING CHECKSUM FILE', () => {
      const exportResult = createValidRealExport();
      const tamperedFiles = exportResult.exportedFiles.filter(f => f.path !== 'CHECKSUMS.txt');
      const tamperedExport = { ...exportResult, exportedFiles: tamperedFiles };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('NOT_VERIFIED');
      expect(res.details).toContain('Missing CHECKSUMS.txt');
    });

    it('MANDATORY TEST 7 — DUPLICATE MANIFEST', () => {
      const exportResult = createValidRealExport();
      const manifestFile = exportResult.exportedFiles.find(f => f.path === 'MANIFEST.json')!;
      const tamperedFiles = [...exportResult.exportedFiles, { path: 'MANIFEST.json', content: manifestFile.content }];
      const tamperedExport = { ...exportResult, exportedFiles: tamperedFiles };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('NOT_VERIFIED');
      expect(res.details).toContain('Duplicate MANIFEST.json');
    });

    it('MANDATORY TEST 8 — DUPLICATE CHECKSUMS', () => {
      const exportResult = createValidRealExport();
      const checksumFile = exportResult.exportedFiles.find(f => f.path === 'CHECKSUMS.txt')!;
      const tamperedFiles = [...exportResult.exportedFiles, { path: 'CHECKSUMS.txt', content: checksumFile.content }];
      const tamperedExport = { ...exportResult, exportedFiles: tamperedFiles };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('NOT_VERIFIED');
      expect(res.details).toContain('Duplicate CHECKSUMS.txt');
    });

    it('MANDATORY TEST 9 — TAMPERED CONTRACT', () => {
      const exportResult = createValidRealExport();
      const tamperedFiles = exportResult.exportedFiles.map(f => {
        if (f.path === 'contracts/Token.sol') {
          return { ...f, content: '// TAMPERED CONTRACT' };
        }
        return f;
      });
      const tamperedExport = { ...exportResult, exportedFiles: tamperedFiles };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('FAIL');
    });

    it('MANDATORY TEST 10 — TAMPERED MANIFEST', () => {
      const exportResult = createValidRealExport();
      const tamperedFiles = exportResult.exportedFiles.map(f => {
        if (f.path === 'MANIFEST.json') {
          return { ...f, content: '{"hashes":{}}' };
        }
        return f;
      });
      const tamperedExport = { ...exportResult, exportedFiles: tamperedFiles };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('FAIL');
    });

    it('MANDATORY TEST 11 — TAMPERED CHECKSUM FILE', () => {
      const exportResult = createValidRealExport();
      const tamperedFiles = exportResult.exportedFiles.map(f => {
        if (f.path === 'CHECKSUMS.txt') {
          return { ...f, content: 'tampered content' };
        }
        return f;
      });
      const tamperedExport = { ...exportResult, exportedFiles: tamperedFiles };
      const res = EngineeringCertificationEngine.collectExportResults(tamperedExport, authGatesPass);
      expect(res.status).toBe('FAIL');
    });

    it('MANDATORY TEST 12 — VALID COMPLETE PACKAGE (CRITICAL END-TO-END TEST)', () => {
      const exportResult = createValidRealExport();
      const options: CertificationOptions = {
        compilationResult: {
          status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0,
          language: 'Solidity', compilerVersion: '0.8.20', durationMs: 10, stdout: '', stderr: '',
          result: { success: true, errors: [], warnings: [], contracts: [] }
        },
        testingResult: {
          status: 'PASS', testingPassed: true, verificationMode: 'REAL_EXECUTION', exitStatus: 0,
          metrics: { testFilesDiscovered: 1, totalTestsDiscovered: 1, testsExecuted: '1', testsPassed: '1', testsFailed: '0' },
          stdout: '', stderr: '', evidence: { testRunner: 'forge', durationMs: 10, command: 'forge test' }, issues: []
        },
        securityAuditResult: {
          isAudited: true, overallStatus: 'PASS', criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, findings: [], analysisTimestamp: new Date().toISOString()
        },
        dependencyResult: {
          overallStatus: 'PASS', projectName: 'TokenProject', checks: [], warnings: [], errors: []
        },
        architectureResult: {
          isValid: true, status: 'PASS', architecturePassed: true, coverageScore: 100, mappedRequirementsCount: 1, missingRequirementsCount: 0, details: '', reportMarkdown: 'report', requirements: {}, comparison: {}, scoreBreakdown: {}
        },
        documentationResult: {
          passed: true, status: 'PASS', documentationPassed: true, documentationCertified: true, reportMarkdown: 'doc', certifiedFiles: validProjectFiles, presentDocs: []
        },
        deploymentResult: {
          passed: true, canDeploy: true, status: 'PASS', deploymentId: 'DEP-1', state: 'COMPLETED', reportMarkdown: 'dep', logs: []
        },
        exportResult
      };

      const finalCert = EngineeringCertificationEngine.certifyProject(validProjectFiles, 'TokenProject', 'prompt', 'ethereum', options);

      expect(finalCert.status).toBe('CERTIFIED');
      expect(finalCert.isCertified).toBe(true);
    });
  });

});
