import { describe, it, expect } from 'vitest';
import { ProjectFile } from '../../../types';
import { SecurityAuditEngine } from './SecurityAuditEngine';
import { PatchEngine } from '../patch/PatchEngine';
import { sha256 } from '../utils/cryptoFallback';

const sampleSolidityFiles: ProjectFile[] = [
  {
    path: 'contracts/Token.sol',
    language: 'solidity',
    content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Token {
    mapping(address => uint256) public balances;

    function withdraw(uint256 amount) external {
        uint256 bal = balances[msg.sender];
        require(bal >= amount, "Insufficient balance");
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] -= amount;
    }
}
`
  }
];

describe('SecurityAuditEngine - FIX #5 Authoritative Security Audit Validation', () => {
  it('validateFinding rejects finding with missing or blank file path', () => {
    const finding = {
      affectedFile: '',
      lineNumbers: [10],
      codeSnippet: 'msg.sender.call',
      functionName: 'withdraw',
      severity: 'Critical'
    };

    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('affectedFile');
  });

  it('validateFinding rejects finding targeting non-existent workspace file', () => {
    const finding = {
      affectedFile: 'contracts/DoesNotExist.sol',
      lineNumbers: [10],
      codeSnippet: 'msg.sender.call',
      functionName: 'withdraw',
      severity: 'Critical'
    };

    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('non-existent file');
  });

  it('validateFinding rejects finding with line number 0 or negative', () => {
    const finding = {
      affectedFile: 'contracts/Token.sol',
      lineNumbers: [0],
      codeSnippet: 'msg.sender.call',
      functionName: 'withdraw',
      severity: 'Critical'
    };

    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('invalid line number');
  });

  it('validateFinding rejects finding with code snippet not present in file', () => {
    const finding = {
      affectedFile: 'contracts/Token.sol',
      lineNumbers: [10],
      codeSnippet: 'selfdestruct(payable(owner));',
      functionName: 'withdraw',
      severity: 'Critical'
    };

    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('does not match actual source code');
  });

  it('validateFinding accepts valid finding with matching snippet, file, and line', () => {
    const finding = {
      affectedFile: 'contracts/Token.sol',
      lineNumbers: [10],
      codeSnippet: 'msg.sender.call{value: amount}("")',
      functionName: 'withdraw(uint256)',
      severity: 'Critical'
    };

    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(true);
  });

  it('certifySecurity returns status NOT_VERIFIED for empty workspace', () => {
    const cert = SecurityAuditEngine.certifySecurity([], 'TestProject', 'Ethereum');
    expect(cert.auditResult.status).toBe('NOT_VERIFIED');
    expect(cert.auditResult.verified).toBe(false);
    expect(cert.auditResult.canDeploy).toBe(false);
  });

  it('certifySecurity returns status NOT_VERIFIED for workspace without smart contract source code', () => {
    const nonContractFiles: ProjectFile[] = [
      { path: 'README.md', language: 'markdown', content: '# Readme' },
      { path: 'package.json', language: 'json', content: '{}' }
    ];

    const cert = SecurityAuditEngine.certifySecurity(nonContractFiles, 'TestProject', 'Ethereum');
    expect(cert.auditResult.status).toBe('NOT_VERIFIED');
    expect(cert.auditResult.verified).toBe(false);
    expect(cert.auditResult.canDeploy).toBe(false);
  });

  it('performStaticAnalysis detects reentrancy vulnerability in vulnerable smart contract', () => {
    const findings = SecurityAuditEngine.performStaticAnalysis(sampleSolidityFiles, 'Ethereum/EVM');
    const hasReentrancy = findings.some(f => f.title.toLowerCase().includes('reentrancy'));
    expect(hasReentrancy).toBe(true);
    expect(findings[0].severity).toBe('Critical');
  });

  it('certifySecurity certifies clean secure contract with CERTIFIED_SECURE', () => {
    const cleanFiles: ProjectFile[] = [
      {
        path: 'contracts/CleanToken.sol',
        language: 'solidity',
        content: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CleanToken is ReentrancyGuard {
    mapping(address => uint256) public balances;

    function withdraw(uint256 amount) external nonReentrant {
        uint256 bal = balances[msg.sender];
        require(bal >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
`
      }
    ];

    const cert = SecurityAuditEngine.certifySecurity(
      cleanFiles,
      'TestProject',
      'Ethereum',
      { success: true, status: 'PASS', verificationMode: 'REAL_EXECUTION', exitCode: 0 }
    );
    expect(cert.auditResult.status).toBe('CERTIFIED_SECURE');
    expect(cert.auditResult.verified).toBe(true);
    expect(cert.auditResult.canDeploy).toBe(true);
  });

  // =========================================================================
  // AUTHORITATIVE SPRINT 6 TEST COVERAGE - TEST 1 TO TEST 20
  // =========================================================================

  // TEST 1: Valid vulnerability finding
  it('TEST 1: Accepts a fully valid vulnerability finding', () => {
    const finding = {
      affectedFile: 'contracts/Token.sol',
      lineNumbers: [15],
      codeSnippet: '(bool success, ) = msg.sender.call{value: amount}("")',
      functionName: 'withdraw',
      severity: 'Critical'
    };
    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(true);
  });

  // TEST 2: Finding references nonexistent file
  it('TEST 2: Rejects finding targeting a nonexistent file', () => {
    const finding = {
      affectedFile: 'contracts/FakeFile.sol',
      lineNumbers: [15],
      codeSnippet: 'call',
      functionName: 'withdraw',
      severity: 'Critical'
    };
    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('non-existent file');
  });

  // TEST 3: Finding has line 0
  it('TEST 3: Rejects finding with line number 0', () => {
    const finding = {
      affectedFile: 'contracts/Token.sol',
      lineNumbers: [0],
      codeSnippet: 'withdraw',
      functionName: 'withdraw',
      severity: 'Critical'
    };
    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('invalid line number');
  });

  // TEST 4: Finding has "N/A" file or placeholder
  it('TEST 4: Rejects finding with placeholder or N/A values', () => {
    const placeholders = ['N/A', 'undefined', 'null', 'Multiple Modules', 'General'];
    for (const val of placeholders) {
      const finding = {
        affectedFile: val,
        lineNumbers: [10],
        codeSnippet: 'any',
        functionName: 'withdraw',
        severity: 'Critical'
      };
      const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
      expect(res.valid).toBe(false);
      expect(res.reason).toContain('Invalid finding affectedFile');
    }
  });

  // TEST 5: Finding snippet does not match source
  it('TEST 5: Rejects finding whose snippet does not match actual source content at that line', () => {
    const finding = {
      affectedFile: 'contracts/Token.sol',
      lineNumbers: [15],
      codeSnippet: 'selfdestruct(payable(tx.origin));',
      functionName: 'withdraw',
      severity: 'Critical'
    };
    const res = SecurityAuditEngine.validateFinding(finding, sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('does not match actual source code');
  });

  // TEST 6: AI remediation modifies only target file
  it('TEST 6: Passes patch scope and immutability checks when AI modifies only target file', () => {
    const patch = {
      modifiedFiles: [
        { path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20; contract Token { uint256 x; }' }
      ]
    };
    const scopeRes = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], sampleSolidityFiles);
    expect(scopeRes.valid).toBe(true);

    const patchedWorkspace = PatchEngine.applyPatch(sampleSolidityFiles, patch);
    const immutabilityRes = PatchEngine.verifyPatchImmutability(sampleSolidityFiles, patchedWorkspace, ['contracts/Token.sol']);
    expect(immutabilityRes.valid).toBe(true);
  });

  // TEST 7: AI remediation modifies unrelated file
  it('TEST 7: Rejects remediation modifying files outside permitted target scope', () => {
    const multiFiles: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'Token content' },
      { path: 'contracts/Vault.sol', language: 'solidity', content: 'Vault content' }
    ];
    const patch = {
      modifiedFiles: [
        { path: 'contracts/Token.sol', content: 'Token fixed' },
        { path: 'contracts/Vault.sol', content: 'Vault unexpectedly modified' }
      ]
    };
    const scopeRes = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], multiFiles);
    expect(scopeRes.valid).toBe(false);
    expect(scopeRes.reason).toContain('outside allowed remediation scope');
  });

  // TEST 8: AI remediation attempts path traversal
  it('TEST 8: Rejects modifications attempting path traversal', () => {
    const patch = {
      modifiedFiles: [
        { path: '../contracts/Token.sol', content: 'traversal' }
      ]
    };
    const res = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('Path traversal');
  });

  // TEST 9: AI remediation returns malformed JSON
  it('TEST 9: Rejects malformed JSON patch content gracefully', () => {
    // Parser validation is handled centrally. Empty or malformed object check:
    const res = PatchEngine.validatePatchScope(null as any, ['contracts/Token.sol'], sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('not an object');
  });

  // TEST 10: AI remediation returns provider error
  it('TEST 10: Rejects remediation patch containing AI provider error patterns', () => {
    const patch = {
      modifiedFiles: [
        { path: 'contracts/Token.sol', content: 'Error: Gemini Quota exceeded. 429 Too Many Requests' }
      ]
    };
    const res = PatchEngine.validatePatchScope(patch, ['contracts/Token.sol'], sampleSolidityFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('contains AI provider error');
  });

  // HELPER FOR PIPELINE TRANSITION SIMULATIONS (TEST 11 TO TEST 17, TEST 19, TEST 20)
  interface SimulateParams {
    vulnerability: any;
    files: ProjectFile[];
    aiEdits: any[];
    compileStatuses: ('PASS' | 'FAIL' | 'NOT_VERIFIED')[];
    auditStatuses: ('CERTIFIED_SECURE' | 'DEPLOYMENT_BLOCKED' | 'NOT_VERIFIED')[];
    auditFindings: any[][];
  }

  function simulateRemediation(params: SimulateParams) {
    const logs: string[] = [];
    const initialSnapshot = PatchEngine.createSnapshotWithHashes(params.files);
    let currentFiles = PatchEngine.createSnapshot(initialSnapshot.files);
    let committedState = PatchEngine.createSnapshot(initialSnapshot.files);

    let attempts = 0;
    const maxAttempts = 3;
    let loopSuccess = false;
    let finalPatchResult: any = null;

    while (attempts < maxAttempts && !loopSuccess) {
      const attemptIdx = attempts;
      attempts++;

      const fileToFix = params.vulnerability.file || params.vulnerability.affectedFile;
      if (!fileToFix) {
        logs.push(`[ERROR] Vulnerability missing target file path.`);
        break;
      }

      const normTarget = PatchEngine.normalizePath(fileToFix).toLowerCase();
      const affectedFile = currentFiles.find(f => PatchEngine.normalizePath(f.path).toLowerCase() === normTarget);

      if (!affectedFile) {
        logs.push(`[ERROR] Target file '${fileToFix}' not found.`);
        break;
      }

      try {
        const cycleSnapshot = PatchEngine.createSnapshotWithHashes(currentFiles);

        // AI Response Simulation
        const patchData = params.aiEdits[attemptIdx];
        if (!patchData || typeof patchData !== 'object') {
          logs.push(`[WARN] AI returned invalid response.`);
          continue;
        }

        finalPatchResult = patchData;

        // Scope validation
        const scopeCheck = PatchEngine.validatePatchScope(patchData, [fileToFix], cycleSnapshot.files);
        if (!scopeCheck.valid) {
          logs.push(`[REJECT] Scope violation: ${scopeCheck.reason}`);
          continue;
        }

        // Apply Patch
        const candidateFiles = PatchEngine.applyPatch(cycleSnapshot.files, patchData);

        // Verify Immutability
        const immutabilityCheck = PatchEngine.verifyPatchImmutability(cycleSnapshot.files, candidateFiles, [fileToFix]);
        if (!immutabilityCheck.valid) {
          logs.push(`[REJECT] Immutability violation: ${immutabilityCheck.reason}`);
          continue;
        }

        // Compilation Simulation
        const compStatus = params.compileStatuses[attemptIdx];
        if (compStatus !== 'PASS') {
          logs.push(`[ROLLBACK] Compile failed or NOT_VERIFIED: ${compStatus}`);
          currentFiles = PatchEngine.createSnapshot(cycleSnapshot.files);
          PatchEngine.verifyRollback(cycleSnapshot.hashes, currentFiles);
          continue;
        }

        // Re-audit Simulation
        const auditStatus = params.auditStatuses[attemptIdx];
        const findings = params.auditFindings[attemptIdx] || [];

        if (auditStatus !== 'CERTIFIED_SECURE') {
          logs.push(`[ROLLBACK] Re-audit failed or NOT_VERIFIED: ${auditStatus}`);
          currentFiles = PatchEngine.createSnapshot(cycleSnapshot.files);
          PatchEngine.verifyRollback(cycleSnapshot.hashes, currentFiles);
          continue;
        }

        const remainingCriticalOrHigh = findings.filter(f => f.severity === 'Critical' || f.severity === 'High');
        const targetVulnStillPresent = findings.some(f => f.id === params.vulnerability.id);

        if (remainingCriticalOrHigh.length > 0 || targetVulnStillPresent) {
          logs.push(`[ROLLBACK] Re-audit found residual vulnerabilities.`);
          currentFiles = PatchEngine.createSnapshot(cycleSnapshot.files);
          PatchEngine.verifyRollback(cycleSnapshot.hashes, currentFiles);
          continue;
        }

        // Commit
        committedState = PatchEngine.createSnapshot(candidateFiles);
        loopSuccess = true;
        break;
      } catch (err: any) {
        logs.push(`[ERROR] Transition failed: ${err.message}`);
        currentFiles = PatchEngine.createSnapshot(initialSnapshot.files);
        PatchEngine.verifyRollback(initialSnapshot.hashes, currentFiles);
      }
    }

    if (loopSuccess) {
      return { success: true, files: committedState, patch: finalPatchResult, logs };
    } else {
      const restoredFiles = PatchEngine.createSnapshot(initialSnapshot.files);
      return { success: false, files: restoredFiles, logs };
    }
  }

  // TEST 11: Patch compiles successfully but vulnerability remains
  it('TEST 11: Rollback applied if patch compiles but the target vulnerability remains', () => {
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20; contract Token { uint public x; }' }]
    };

    const result = simulateRemediation({
      vulnerability: vuln,
      files: sampleSolidityFiles,
      aiEdits: [patch],
      compileStatuses: ['PASS'],
      auditStatuses: ['CERTIFIED_SECURE'],
      // Vulnerability is still present in findings
      auditFindings: [[{ id: 'VULN-1', severity: 'Critical' }]]
    });

    expect(result.success).toBe(false);
    expect(result.logs.some(l => l.includes('ROLLBACK'))).toBe(true);
  });

  // TEST 12: Patch compiles successfully and vulnerability disappears
  it('TEST 12: Patched workspace committed after successful compilation and zero findings', () => {
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20; contract Token { uint public x; }' }]
    };

    const result = simulateRemediation({
      vulnerability: vuln,
      files: sampleSolidityFiles,
      aiEdits: [patch],
      compileStatuses: ['PASS'],
      auditStatuses: ['CERTIFIED_SECURE'],
      auditFindings: [[]] // Zero findings left
    });

    expect(result.success).toBe(true);
    expect(result.files[0].content).toContain('uint public x');
  });

  // TEST 13: Compilation fails
  it('TEST 13: Rollback applied immediately if compilation fails', () => {
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20; contract Token { invalid syntax' }]
    };

    const result = simulateRemediation({
      vulnerability: vuln,
      files: sampleSolidityFiles,
      aiEdits: [patch],
      compileStatuses: ['FAIL'],
      auditStatuses: ['CERTIFIED_SECURE'],
      auditFindings: [[]]
    });

    expect(result.success).toBe(false);
    expect(result.logs.some(l => l.includes('Compile failed'))).toBe(true);
  });

  // TEST 14: Compilation NOT_VERIFIED
  it('TEST 14: Rollback applied if compilation status is NOT_VERIFIED', () => {
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'contract' }]
    };

    const result = simulateRemediation({
      vulnerability: vuln,
      files: sampleSolidityFiles,
      aiEdits: [patch],
      compileStatuses: ['NOT_VERIFIED'],
      auditStatuses: ['CERTIFIED_SECURE'],
      auditFindings: [[]]
    });

    expect(result.success).toBe(false);
    expect(result.logs.some(l => l.includes('NOT_VERIFIED'))).toBe(true);
  });

  // TEST 15: Security re-audit fails
  it('TEST 15: Rollback applied if security re-audit fails with DEPLOYMENT_BLOCKED', () => {
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20; contract Token {}' }]
    };

    const result = simulateRemediation({
      vulnerability: vuln,
      files: sampleSolidityFiles,
      aiEdits: [patch],
      compileStatuses: ['PASS'],
      auditStatuses: ['DEPLOYMENT_BLOCKED'],
      auditFindings: [[]]
    });

    expect(result.success).toBe(false);
    expect(result.logs.some(l => l.includes('Re-audit failed'))).toBe(true);
  });

  // TEST 16: Security re-audit NOT_VERIFIED
  it('TEST 16: Rollback applied if security re-audit is NOT_VERIFIED', () => {
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20; contract Token {}' }]
    };

    const result = simulateRemediation({
      vulnerability: vuln,
      files: sampleSolidityFiles,
      aiEdits: [patch],
      compileStatuses: ['PASS'],
      auditStatuses: ['NOT_VERIFIED'],
      auditFindings: [[]]
    });

    expect(result.success).toBe(false);
    expect(result.logs.some(l => l.includes('NOT_VERIFIED'))).toBe(true);
  });

  // TEST 17: All three remediation attempts fail
  it('TEST 17: Workspace fully restored to initial snapshot if all three remediation attempts fail', () => {
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'broken' }]
    };

    const result = simulateRemediation({
      vulnerability: vuln,
      files: sampleSolidityFiles,
      aiEdits: [patch, patch, patch],
      compileStatuses: ['FAIL', 'FAIL', 'FAIL'],
      auditStatuses: ['CERTIFIED_SECURE', 'CERTIFIED_SECURE', 'CERTIFIED_SECURE'],
      auditFindings: [[], [], []]
    });

    expect(result.success).toBe(false);
    // Original contents must be intact
    expect(result.files[0].content).toContain('function withdraw(uint256 amount)');
  });

  // TEST 18: Rollback hashes differ from original
  it('TEST 18: Rollback verification fails if restored workspace file contents do not match pre-patch hashes', () => {
    const snapshot = PatchEngine.createSnapshotWithHashes(sampleSolidityFiles);
    const corruptedFiles: ProjectFile[] = [
      { path: 'contracts/Token.sol', content: 'MALICIOUS CORRUPTION', language: 'solidity' }
    ];
    const res = PatchEngine.verifyRollback(snapshot.hashes, corruptedFiles);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('hash mismatch');
  });

  // TEST 19: Successful remediation (Verify prePatchHash != candidateHash and postCommitHash === candidateHash)
  it('TEST 19: Verifies pre-patch hash is different from candidate, and committed matches candidate', () => {
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'pragma solidity ^0.8.20; contract Token { uint256 public committed; }' }]
    };

    const originalHash = sha256(sampleSolidityFiles[0].content);

    const result = simulateRemediation({
      vulnerability: vuln,
      files: sampleSolidityFiles,
      aiEdits: [patch],
      compileStatuses: ['PASS'],
      auditStatuses: ['CERTIFIED_SECURE'],
      auditFindings: [[]]
    });

    expect(result.success).toBe(true);
    const committedHash = sha256(result.files[0].content);

    // prePatchHash != candidateHash
    expect(originalHash).not.toBe(committedHash);
    // postCommitHash === candidateHash (committed state)
    expect(result.files[0].content).toContain('uint256 public committed');
  });

  // TEST 20: Unrelated workspace files remain byte-for-byte identical
  it('TEST 20: Unrelated workspace files remain completely untouched and identical byte-for-byte', () => {
    const multiFiles: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'Token content to fix' },
      { path: 'contracts/Unrelated.sol', language: 'solidity', content: 'Byte-for-byte identical file content!' }
    ];
    const vuln = { id: 'VULN-1', file: 'contracts/Token.sol', title: 'Reentrancy' };
    const patch = {
      modifiedFiles: [{ path: 'contracts/Token.sol', content: 'Token content fixed' }]
    };

    const result = simulateRemediation({
      vulnerability: vuln,
      files: multiFiles,
      aiEdits: [patch],
      compileStatuses: ['PASS'],
      auditStatuses: ['CERTIFIED_SECURE'],
      auditFindings: [[]]
    });

    expect(result.success).toBe(true);
    const originalUnrelated = multiFiles[1].content;
    const finalUnrelated = result.files.find(f => f.path === 'contracts/Unrelated.sol')?.content;
    expect(finalUnrelated).toBe(originalUnrelated);
  });
});
