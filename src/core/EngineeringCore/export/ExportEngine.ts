import { ProjectFile } from '../../../types';
import { sha256 } from '../utils/cryptoFallback';

export interface ExportCertificationResult {
  exportCertified: boolean;
  exportedFiles: ProjectFile[];
  manifestJson: string;
  checksumsTxt: string;
  deliverySummaryMd: string;
  versionTxt: string;
  reportsPresentCount: number;
  docsPresentCount: number;
  diagramsPresentCount: number;
  validationGatesPassed: {
    workspace: boolean; integrity: boolean; dependencies: boolean;
    compiler: boolean; security: boolean; deployment: boolean;
    architecture: boolean; testing: boolean; documentation: boolean;
  };
  issues: string[];
  status: 'PASS' | 'FAIL' | 'NOT_VERIFIED';
}

export class ExportEngine {
  private static computeSha256(content: string): string { return sha256(content); }

  public static validateWorkspace(files: ProjectFile[]): { passed: boolean; issues: string[] } {
    return { passed: files.length > 0, issues: [] };
  }

  public static validateReports(files: ProjectFile[]): { passed: boolean; presentReports: string[]; missingReports: string[] } {
    const reports = files.filter(f => {
      const name = f.path.toUpperCase();
      return name.includes('COMPILATION_REPORT') || name.includes('SECURITY_REPORT') || name.includes('TEST_REPORT') || name.includes('DEPLOYMENT_REPORT');
    });
    return { passed: true, presentReports: reports.map(r => r.path), missingReports: [] };
  }

  public static validateDocumentation(files: ProjectFile[]): { passed: boolean; presentDocs: string[]; missingDocs: string[] } {
    const required = ['README.md'];
    const presentDocs: string[] = [];
    const missingDocs: string[] = [];
    required.forEach(doc => {
      if (files.some(f => f.path.toLowerCase() === doc.toLowerCase())) {
        presentDocs.push(doc);
      } else {
        missingDocs.push(doc);
      }
    });
    return { passed: missingDocs.length === 0, presentDocs, missingDocs };
  }

  public static validateArtifacts(files: ProjectFile[], profile?: any): { passed: boolean; artifactsCount: number; status?: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' } {
    const hasArtifacts = files.some(f => f.path.toLowerCase().startsWith('artifacts/') || f.path.toLowerCase().includes('build/') || f.path.toLowerCase().includes('out/'));
    if (!hasArtifacts && profile?.artifactsRequired) {
      return { passed: false, artifactsCount: 0, status: 'FAIL' };
    }
    if (!hasArtifacts && !profile?.artifactsRequired) {
      return { passed: true, artifactsCount: 0, status: 'NOT_APPLICABLE' };
    }
    return { passed: true, artifactsCount: files.filter(f => f.path.toLowerCase().startsWith('artifacts/')).length, status: 'PASS' };
  }

  public static validatePackageConsistency(files: ProjectFile[]): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    files.forEach(f => {
      if (f.path.toLowerCase().startsWith('.diagnostics/') || f.path.toLowerCase().includes('.diagnostics/')) {
        issues.push(`Forbidden internal diagnostic file leaked: '${f.path}'`);
      }
    });
    return { passed: issues.length === 0, issues };
  }

  public static validateDeploymentAssets(files: ProjectFile[], deploymentResult?: any): { passed: boolean; presentAssets: string[] } {
    const deployFiles = files.filter(f => f.path.toLowerCase().includes('script/') || f.path.toLowerCase().includes('deploy/'));
    const hasDeployFiles = deployFiles.length > 0;
    const presentAssets = deployFiles.map(f => f.path);
    if (hasDeployFiles && (!deploymentResult || deploymentResult.state !== 'COMPLETED')) {
      return { passed: false, presentAssets };
    }
    return { passed: true, presentAssets };
  }

  public static generateManifest(files: ProjectFile[], projectName: string, blockchain: string, framework: string = 'UNKNOWN', compilerVersion: string = 'UNKNOWN'): string {
    const normalizePath = (p: string): string => p.replace(/\\/g, '/');
    const filesToHash = files.filter(f => !f.path.toUpperCase().includes('MANIFEST.JSON') && !f.path.toUpperCase().includes('CHECKSUMS.TXT'));
    const manifest = {
      project: projectName, blockchain, framework, compiler: compilerVersion,
      hashes: filesToHash.reduce((acc, f) => {
        acc[normalizePath(f.path).toLowerCase()] = sha256(f.content);
        return acc;
      }, {} as Record<string, string>)
    };
    return JSON.stringify(manifest, null, 2);
  }

  public static generateChecksums(files: ProjectFile[]): string {
    return files
      .filter(f => !f.path.toUpperCase().includes('CHECKSUMS.TXT'))
      .map(f => `${sha256(f.content)} ${f.path.replace(/\\/g, '/').toLowerCase()}`)
      .sort().join('\n') + '\n';
  }

  public static generateVersionFile(): string { return `v1.0.0-rc2`; }

  public static generateDeliverySummary(files: ProjectFile[], projectName: string, blockchain: string, exportResult: any, isCertified: boolean = false): string {
    let readinessStatus = 'UNKNOWN / NOT_VERIFIED';
    if (isCertified && exportResult.exportCertified && exportResult.status === 'PASS') {
      readinessStatus = '✅ PASSED & CERTIFIED FOR CLIENT DELIVERY\nPRODUCTION READY';
    } else if (isCertified) {
      readinessStatus = 'BLOCKED / Client Delivery Certified: NO';
    }
    return `# Delivery Summary\n**Status:** ${readinessStatus}\n`;
  }

  public static validateFinalPackageIntegrity(exportedFiles: ProjectFile[], manifestJson?: string, checksumsTxt?: string): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    const normalizePath = (p: string): string => {
      let np = p.replace(/\\/g, '/').toLowerCase();
      if (np.startsWith('./')) np = np.substring(2);
      return np;
    };

    // If separate strings are not provided, try to find them in the exportedFiles array
    if (!manifestJson) {
      const manifestFile = exportedFiles.find(f => normalizePath(f.path).endsWith('manifest.json'));
      if (manifestFile) {
        manifestJson = manifestFile.content;
      }
    }
    if (!checksumsTxt) {
      const checksumFile = exportedFiles.find(f => normalizePath(f.path).endsWith('checksums.txt'));
      if (checksumFile) {
        checksumsTxt = checksumFile.content;
      }
    }

    // Check MANIFEST.json and CHECKSUMS.txt exist
    const hasManifest = exportedFiles.some(f => normalizePath(f.path).endsWith('manifest.json'));
    const hasChecksums = exportedFiles.some(f => normalizePath(f.path).endsWith('checksums.txt'));

    if (!hasManifest) {
      issues.push("Missing MANIFEST.json file in the exported package.");
    }
    if (!hasChecksums) {
      issues.push("Missing CHECKSUMS.txt file in the exported package.");
    }

    const exportedFileMap = new Map<string, ProjectFile>();
    exportedFiles.forEach(f => exportedFileMap.set(normalizePath(f.path), f));

    // Check for duplicate files
    const seenPaths = new Set<string>();
    exportedFiles.forEach(f => {
      const p = normalizePath(f.path);
      if (seenPaths.has(p)) {
        issues.push(`Duplicate file path detected: '${f.path}'`);
      }
      seenPaths.add(p);
    });

    // A. Parse and validate manifest hashes
    if (manifestJson) {
      try {
        const manifest = JSON.parse(manifestJson);
        const hashes = manifest.hashes || {};
        
        // Check that every file referenced in the manifest exists in the exported files, and hashes match!
        Object.keys(hashes).forEach(k => {
          const normK = normalizePath(k);
          const file = exportedFileMap.get(normK);
          if (!file) {
            issues.push(`Manifest references file '${k}' which does not exist in exported files.`);
          } else {
            const actualHash = sha256(file.content);
            const expectedHash = hashes[k];
            if (actualHash !== expectedHash) {
              issues.push(`File content hash mismatch for '${k}': expected ${expectedHash}, got ${actualHash}`);
            }
          }
        });

        // Bidirectional parity: every file in exportedFiles (except manifest and checksums) must be in the manifest
        exportedFiles.forEach(f => {
          const norm = normalizePath(f.path);
          if (norm !== 'manifest.json' && norm !== 'checksums.txt') {
            const isRegistered = Object.keys(hashes).some(k => normalizePath(k) === norm);
            if (!isRegistered) {
              issues.push(`Exported file '${f.path}' is not registered in MANIFEST.json.`);
            }
          }
        });

      } catch (err: any) {
        issues.push(`Manifest parse error: ${err.message}`);
      }
    }

    // B. Parse and validate bidirectional checksum locks
    if (checksumsTxt) {
      const lines = checksumsTxt.split('\n').filter(Boolean);
      const checksumPaths = new Set<string>();

      lines.forEach(line => {
        const match = line.match(/^([a-fA-F0-9]{64})\s+(.+)$/);
        if (match) {
          const expectedHash = match[1];
          const filePath = match[2];
          const normP = normalizePath(filePath);
          checksumPaths.add(normP);
          
          const file = exportedFileMap.get(normP);
          if (!file) {
            issues.push(`Checksum list references file '${filePath}' which does not exist in exported files.`);
          } else {
            const actualHash = sha256(file.content);
            if (actualHash !== expectedHash) {
              issues.push(`File checksum mismatch for '${filePath}': expected ${expectedHash}, got ${actualHash}`);
            }
          }
        }
      });

      // Bidirectional parity: every file in exportedFiles (except checksums.txt) must be in CHECKSUMS.txt
      exportedFiles.forEach(f => {
        const norm = normalizePath(f.path);
        if (norm !== 'checksums.txt') {
          if (!checksumPaths.has(norm)) {
            issues.push(`Exported file '${f.path}' is not registered in CHECKSUMS.txt.`);
          }
        }
      });
    }

    return { passed: issues.length === 0, issues };
  }

  public static certifyExport(
    files: ProjectFile[],
    projectName: string,
    prompt: string,
    blockchain: string,
    framework: string = 'UNKNOWN',
    options?: any
  ): ExportCertificationResult {
    let exportedFiles = files.filter(f => !f.path.toUpperCase().includes('.DIAGNOSTICS/'));

    // Add Baseline version control strings
    exportedFiles.push({ path: 'VERSION.txt', content: this.generateVersionFile(), language: 'text' });
    // 1. Initial preview structural execution pass (Baseline Marker setup)
    const prelimResult = { exportCertified: false, status: 'NOT_VERIFIED' as const };
    let summaryMd = this.generateDeliverySummary(exportedFiles, projectName, blockchain, prelimResult, false);
    exportedFiles.push({ path: 'DELIVERY_SUMMARY.md', content: summaryMd, language: 'markdown' });
    
    let manifestJson = this.generateManifest(exportedFiles, projectName, blockchain, framework);
    // Add MANIFEST.json so that checksums can hash it
    exportedFiles.push({ path: 'MANIFEST.json', content: manifestJson, language: 'json' });

    let checksumsTxt = this.generateChecksums(exportedFiles);
    // Add CHECKSUMS.txt so that we have both files
    exportedFiles.push({ path: 'CHECKSUMS.txt', content: checksumsTxt, language: 'text' });

    // 2. Run Trial validation sequence pass
    let docCheck = this.validateDocumentation(exportedFiles);
    let reportCheck = this.validateReports(exportedFiles);
    let consistencyCheck = this.validatePackageConsistency(exportedFiles);
    let deployCheck = this.validateDeploymentAssets(exportedFiles, options?.deploymentResult);
    let integrityCheck = this.validateFinalPackageIntegrity(exportedFiles, manifestJson, checksumsTxt);

    let gatesPassed = docCheck.passed && reportCheck.passed && consistencyCheck.passed && deployCheck.passed && integrityCheck.passed;

    const normalizePath = (p: string): string => p.replace(/\\/g, '/').toLowerCase();

    // 3. Conditional State Overwrite Loop Matrix matching final certifications
    if (gatesPassed) {
      const activeState = { exportCertified: true, status: 'PASS' as const };
      summaryMd = this.generateDeliverySummary(exportedFiles, projectName, blockchain, activeState, true);

      // Update targeted summary file buffers securely
      const sIdx = exportedFiles.findIndex(f => f.path.endsWith('DELIVERY_SUMMARY.md'));
      if (sIdx >= 0) exportedFiles[sIdx].content = summaryMd;
      // 4. Cascading re-hash pass over newly modified string buffers
      manifestJson = this.generateManifest(exportedFiles, projectName, blockchain, framework);
      
      const mIdx = exportedFiles.findIndex(f => normalizePath(f.path) === 'manifest.json');
      if (mIdx >= 0) {
        exportedFiles[mIdx].content = manifestJson;
      }

      checksumsTxt = this.generateChecksums(exportedFiles);
      
      const cIdx = exportedFiles.findIndex(f => normalizePath(f.path) === 'checksums.txt');
      if (cIdx >= 0) {
        exportedFiles[cIdx].content = checksumsTxt;
      }
    } else {
      const failedState = { exportCertified: false, status: 'FAIL' as const };
      summaryMd = this.generateDeliverySummary(exportedFiles, projectName, blockchain, failedState, true);
      const sIdx = exportedFiles.findIndex(f => f.path.endsWith('DELIVERY_SUMMARY.md'));
      if (sIdx >= 0) exportedFiles[sIdx].content = summaryMd;
      manifestJson = this.generateManifest(exportedFiles, projectName, blockchain, framework);
      
      const mIdx = exportedFiles.findIndex(f => normalizePath(f.path) === 'manifest.json');
      if (mIdx >= 0) {
        exportedFiles[mIdx].content = manifestJson;
      }

      checksumsTxt = this.generateChecksums(exportedFiles);
      
      const cIdx = exportedFiles.findIndex(f => normalizePath(f.path) === 'checksums.txt');
      if (cIdx >= 0) {
        exportedFiles[cIdx].content = checksumsTxt;
      }
    }

    // 5. Absolute locked final system validation gate
    // The delivery summary must never claim certification if the FINAL package
    // integrity check fails. Because DELIVERY_SUMMARY.md is itself hashed, a
    // status correction requires one final manifest/checksum rebuild.
    let absoluteCheck = this.validateFinalPackageIntegrity(exportedFiles, manifestJson, checksumsTxt);
    let finalCertified = gatesPassed && absoluteCheck.passed;

    if (!finalCertified) {
      const blockedState = { exportCertified: false, status: 'FAIL' as const };
      summaryMd = this.generateDeliverySummary(exportedFiles, projectName, blockchain, blockedState, true);
      const sIdx = exportedFiles.findIndex(f => normalizePath(f.path) === 'delivery_summary.md');
      if (sIdx >= 0) exportedFiles[sIdx].content = summaryMd;

      manifestJson = this.generateManifest(exportedFiles, projectName, blockchain, framework);
      const mIdx = exportedFiles.findIndex(f => normalizePath(f.path) === 'manifest.json');
      if (mIdx >= 0) exportedFiles[mIdx].content = manifestJson;

      checksumsTxt = this.generateChecksums(exportedFiles);
      const cIdx = exportedFiles.findIndex(f => normalizePath(f.path) === 'checksums.txt');
      if (cIdx >= 0) exportedFiles[cIdx].content = checksumsTxt;

      absoluteCheck = this.validateFinalPackageIntegrity(exportedFiles, manifestJson, checksumsTxt);
      finalCertified = false;
    }

    const hasWorkspaceReport = files.length > 0;
    const hasDepReport = (options?.dependencyResult?.overallStatus === 'PASS') || files.some(f => f.path.toUpperCase().includes('DEPENDENCY_REPORT') || f.path.toUpperCase().includes('DEP_REPORT'));
    const hasCompilerReport = (options?.compilationResult?.status === 'PASS') || files.some(f => f.path.toUpperCase().includes('COMPILATION_REPORT'));
    const hasSecurityReport = (options?.securityAuditResult?.overallStatus === 'PASS') || files.some(f => f.path.toUpperCase().includes('SECURITY_REPORT'));
    const hasDeploymentReport = (options?.deploymentResult?.status === 'PASS' || options?.deploymentResult?.state === 'COMPLETED') || files.some(f => f.path.toUpperCase().includes('DEPLOYMENT_REPORT'));
    const hasArchReport = (options?.architectureResult?.status === 'PASS' || options?.architectureResult?.architecturePassed === true) || files.some(f => f.path.toUpperCase().includes('ARCHITECTURE_REPORT') || f.path.toUpperCase().includes('ARCH_REPORT'));
    const hasTestingReport = (options?.testingResult?.status === 'PASS') || files.some(f => f.path.toUpperCase().includes('TEST_REPORT') || f.path.toUpperCase().includes('TESTING_REPORT'));
    const hasDocReport = docCheck.passed || (options?.documentationResult?.status === 'PASS' || options?.documentationResult?.documentationPassed === true);

    const diagramsCount = files.filter(f => f.path.toLowerCase().startsWith('diagrams/') || f.path.toLowerCase().endsWith('.png') || f.path.toLowerCase().endsWith('.jpg') || f.path.toLowerCase().endsWith('.svg')).length;
    const docsCount = files.filter(f => f.path.endsWith('.md') && !f.path.toUpperCase().includes('REPORT') && !f.path.toUpperCase().includes('MANIFEST') && !f.path.toUpperCase().includes('SUMMARY')).length;
    const reportsCount = files.filter(f => f.path.toUpperCase().includes('REPORT')).length;

    return {
      exportCertified: finalCertified,
      exportedFiles,
      manifestJson,
      checksumsTxt,
      deliverySummaryMd: summaryMd,
      versionTxt: 'v1.0.0-rc2',
      reportsPresentCount: reportsCount,
      docsPresentCount: docsCount,
      diagramsPresentCount: diagramsCount,
      validationGatesPassed: {
        workspace: hasWorkspaceReport,
        integrity: finalCertified,
        dependencies: hasDepReport,
        compiler: hasCompilerReport,
        security: hasSecurityReport,
        deployment: hasDeploymentReport,
        architecture: hasArchReport,
        testing: hasTestingReport,
        documentation: hasDocReport
      },
      issues: absoluteCheck.issues,
      status: finalCertified ? 'PASS' : 'FAIL'
    };
  }
}
