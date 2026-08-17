import { describe, it, expect } from 'vitest';
import { ProjectFile } from '../../../types';
import { ExportEngine } from './ExportEngine';

const mockBaseFiles: ProjectFile[] = [
  { path: 'contracts/Token.sol', language: 'solidity', content: 'pragma solidity ^0.8.20; contract Token {}' },
  { path: 'test/Token.t.sol', language: 'solidity', content: 'pragma solidity ^0.8.20; contract TokenTest {}' }
];

describe('ExportEngine - FIX #4 Strict Export Validation', () => {
  it('validateReports fails if internal diagnostic files are present in client package', () => {
    const filesWithLeakedReport: ProjectFile[] = [
      ...mockBaseFiles,
      { path: 'COMPILATION_REPORT.md', language: 'markdown', content: '# Internal Compilation Report' }
    ];

    const result = ExportEngine.validateReports(filesWithLeakedReport);
    expect(result.passed).toBe(false);
  });

  it('validateReports passes if no internal diagnostic files are present in client package', () => {
    const cleanFiles: ProjectFile[] = [...mockBaseFiles, { path: 'README.md', language: 'markdown', content: '# Readme' }];
    const result = ExportEngine.validateReports(cleanFiles);
    expect(result.passed).toBe(true);
  });

  it('validateDocumentation fails if required documentation is missing', () => {
    const result = ExportEngine.validateDocumentation(mockBaseFiles);
    expect(result.passed).toBe(false);
    expect(result.missingDocs).toContain('README.md');
  });

  it('generateManifest uses actual compiler version and never hardcodes 0.8.20 when compiler is unknown', () => {
    const manifestJson = ExportEngine.generateManifest(mockBaseFiles, 'TestProject', 'Ethereum', 'Foundry', 'UNKNOWN');
    const manifest = JSON.parse(manifestJson);
    expect(manifest.compiler).toBe('UNKNOWN');
  });

  it('certifyExport does NOT generate fake missing diagrams or docs', () => {
    const certResult = ExportEngine.certifyExport(mockBaseFiles, 'TestProject', 'Build token', 'Ethereum');
    
    // certifyExport should NOT have added fake README.md or diagrams to exportedFiles
    expect(certResult.exportedFiles.some(f => f.content.includes('Documentation for TestProject on Ethereum.'))).toBe(false);
    expect(certResult.exportedFiles.some(f => f.content.includes('```mermaid'))).toBe(false);
    // Because required docs were missing, exportCertified must be false
    expect(certResult.exportCertified).toBe(false);
  });

  it('validateDeploymentAssets returns passed=false when deployment files exist but deploymentResult evidence is missing', () => {
    const filesWithDeploy: ProjectFile[] = [
      ...mockBaseFiles,
      { path: 'script/Deploy.s.sol', language: 'solidity', content: 'script' }
    ];
    const res = ExportEngine.validateDeploymentAssets(filesWithDeploy, undefined);
    expect(res.passed).toBe(false);
    expect(res.presentAssets).toContain('script/Deploy.s.sol');
  });

  it('validateDeploymentAssets returns passed=true when deploymentResult has authoritative evidence', () => {
    const filesWithDeploy: ProjectFile[] = [
      ...mockBaseFiles,
      { path: 'script/Deploy.s.sol', language: 'solidity', content: 'script' }
    ];
    const deploymentResult = { deploymentId: 'DEP-100', state: 'COMPLETED', reportMarkdown: 'Deploy report' };
    const res = ExportEngine.validateDeploymentAssets(filesWithDeploy, deploymentResult);
    expect(res.passed).toBe(true);
  });

  it('Export package with invalid internal diagnostics -> FAIL', () => {
    const leakedDiagnosticFiles: ProjectFile[] = [
      ...mockBaseFiles,
      { path: '.diagnostics/COMPILATION_REPORT.md', language: 'markdown', content: 'internal compilation logs' }
    ];
    const res = ExportEngine.validatePackageConsistency(leakedDiagnosticFiles);
    expect(res.passed).toBe(false);
    expect(res.issues[0]).toContain('Forbidden internal diagnostic file');
  });

  it('Export package valid -> status = PASS', () => {
    const cleanFiles: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' },
      { path: 'test/Token.t.sol', language: 'solidity', content: 'contract TokenTest {}' }
    ];
    const res = ExportEngine.validatePackageConsistency(cleanFiles);
    expect(res.passed).toBe(true);
  });

  it('No artifacts when artifacts are optional -> NOT_APPLICABLE/non-blocking', () => {
    const res = ExportEngine.validateArtifacts(mockBaseFiles, { artifactsRequired: false });
    expect(res.passed).toBe(true);
    expect(res.status).toBe('NOT_APPLICABLE');
  });

  it('No artifacts when required -> FAIL/NOT_VERIFIED', () => {
    const res = ExportEngine.validateArtifacts(mockBaseFiles, { artifactsRequired: true });
    expect(res.passed).toBe(false);
    expect(res.status).toBe('FAIL');
  });

  it('TEST 1: No dummyExportResult exists in production code', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, 'ExportEngine.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content.includes('dummyExportResult')).toBe(false);
  });

  it('TEST 2: Project with 0 diagrams reports diagramsPresentCount = 0', () => {
    const filesWithNoDiagrams: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' },
      { path: 'README.md', language: 'markdown', content: '# Readme' }
    ];
    const certResult = ExportEngine.certifyExport(filesWithNoDiagrams, 'TestProject', 'Build', 'Ethereum');
    expect(certResult.diagramsPresentCount).toBe(0);
  });

  it('TEST 3: Project with 2 actual diagrams reports diagramsPresentCount = 2', () => {
    const filesWithTwoDiagrams: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' },
      { path: 'README.md', language: 'markdown', content: '# Readme' },
      { path: 'diagrams/architecture.png', language: 'text', content: 'image-data' },
      { path: 'diagrams/flowchart.png', language: 'text', content: 'image-data' }
    ];
    const certResult = ExportEngine.certifyExport(filesWithTwoDiagrams, 'TestProject', 'Build', 'Ethereum');
    expect(certResult.diagramsPresentCount).toBe(2);
  });

  it('TEST 7: Delivery summary must never fabricate CERTIFIED/CLIENT READY when final certification is unknown', () => {
    const files: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' },
      { path: 'README.md', language: 'markdown', content: '# Readme' }
    ];
    const exportResult = ExportEngine.certifyExport(files, 'TestProject', 'Build', 'Ethereum');
    const summary = ExportEngine.generateDeliverySummary(exportResult.exportedFiles, 'TestProject', 'Ethereum', exportResult, false);
    
    expect(summary).toContain('UNKNOWN / NOT_VERIFIED');
    expect(summary).not.toContain('✅ PASSED & CERTIFIED FOR CLIENT DELIVERY');
    expect(summary).not.toContain('PRODUCTION READY');
    expect(summary).not.toContain('PASSED');
    expect(summary).not.toContain('CLIENT READY');
  });

  it('validateFinalPackageIntegrity fails when duplicate file paths exist', () => {
    const files: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' },
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' }
    ];
    const res = ExportEngine.validateFinalPackageIntegrity(files);
    expect(res.passed).toBe(false);
    expect(res.issues.some(i => i.includes('Duplicate file path'))).toBe(true);
  });

  it('validateFinalPackageIntegrity fails when MANIFEST.json is missing', () => {
    const files: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' },
      { path: 'CHECKSUMS.txt', language: 'text', content: 'checksum' }
    ];
    const res = ExportEngine.validateFinalPackageIntegrity(files);
    expect(res.passed).toBe(false);
    expect(res.issues.some(i => i.includes('Missing MANIFEST.json'))).toBe(true);
  });

  it('validateFinalPackageIntegrity fails when CHECKSUMS.txt is missing', () => {
    const files: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' },
      { path: 'MANIFEST.json', language: 'json', content: '{}' }
    ];
    const res = ExportEngine.validateFinalPackageIntegrity(files);
    expect(res.passed).toBe(false);
    expect(res.issues.some(i => i.includes('Missing CHECKSUMS.txt'))).toBe(true);
  });

  it('validateFinalPackageIntegrity passes on complete valid package generated by certifyExport', () => {
    const files: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Token {}' },
      { path: 'README.md', language: 'markdown', content: '# Readme' },
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
    const certResult = ExportEngine.certifyExport(files, 'TestProject', 'Build token', 'Ethereum');
    const integrityRes = ExportEngine.validateFinalPackageIntegrity(certResult.exportedFiles);
    expect(integrityRes.passed).toBe(true);
    expect(certResult.validationGatesPassed.integrity).toBe(true);
  });

  it('TEST 21: CHECKSUMS.txt contains non-existent file -> validateFinalPackageIntegrity fails', () => {
    const files: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: 'contract Token {}' },
      { path: 'MANIFEST.json', language: 'json', content: '{"projectName":"Test"}' },
      { path: 'CHECKSUMS.txt', language: 'text', content: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef  contracts/GhostFile.sol' }
    ];
    const res = ExportEngine.validateFinalPackageIntegrity(files);
    expect(res.passed).toBe(false);
    expect(res.issues.some(i => i.includes('contracts/GhostFile.sol') || i.includes('does not exist'))).toBe(true);
  });

  it('TEST 22: Final integrity validation fails after preliminary certification -> DELIVERY_SUMMARY does NOT claim certification', () => {
    const files: ProjectFile[] = [
      { path: 'contracts/Token.sol', language: 'solidity', content: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Token {}' },
      { path: 'README.md', language: 'markdown', content: '# Readme' },
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

    const certResult = ExportEngine.certifyExport(files, 'TestProject', 'Build token', 'Ethereum');
    // Corrupt one file in exportedFiles after export certification
    const corruptedExported = certResult.exportedFiles.map(f => {
      if (f.path === 'contracts/Token.sol') {
        return { ...f, content: 'corrupted content after export' };
      }
      return f;
    });

    const finalIntegrity = ExportEngine.validateFinalPackageIntegrity(corruptedExported);
    expect(finalIntegrity.passed).toBe(false);

    // Verify Delivery Summary for corrupted export does not claim certified
    const summary = ExportEngine.generateDeliverySummary(corruptedExported, 'TestProject', 'Ethereum', { exportCertified: false, status: 'FAIL' }, true);
    expect(summary).not.toContain('✅ PASSED & CERTIFIED FOR CLIENT DELIVERY');
    expect(summary).toContain('BLOCKED');
    expect(summary).toContain('Client Delivery Certified: NO');
  });
});
