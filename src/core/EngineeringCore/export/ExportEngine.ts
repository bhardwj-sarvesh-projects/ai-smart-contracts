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
    workspace: boolean;
    integrity: boolean;
    dependencies: boolean;
    compiler: boolean;
    security: boolean;
    deployment: boolean;
    architecture: boolean;
    testing: boolean;
    documentation: boolean;
  };
  issues: string[];
  status: 'PASS' | 'FAIL' | 'NOT_VERIFIED';
}

export class ExportEngine {

  private static computeSha256(content: string): string {
    return sha256(content);
  }

  /**
   * 1. Validate Workspace
   */
  public static validateWorkspace(files: ProjectFile[]): { passed: boolean; issues: string[] } {
    const issues: string[] = [];
    if (!files || files.length === 0) {
      issues.push('Workspace is empty (no files found)');
    }
    const hasSource = files.some(f =>
      f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move') || f.path.endsWith('.ts')
    );
    if (!hasSource) {
      issues.push('Missing smart contract source files');
    }
    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * 2. Validate Reports & Diagnostics Isolation
   * Ensures no internal platform diagnostics, temporary files, or provider error logs exist in client files.
   */
  public static validateReports(files: ProjectFile[]): {
    passed: boolean;
    presentReports: string[];
    missingReports: string[];
  } {
    const internalDiagnosticFiles = [
      'QUALITY_REPORT.MD',
      'COMPILATION_REPORT.MD',
      'SECURITY_REPORT.MD',
      'ARCHITECTURE_REPORT.MD',
      'TEST_REPORT.MD',
      'TEST_COVERAGE.MD',
      'DOCUMENTATION_REPORT.MD',
      'DEPLOYMENT_REPORT.MD',
      'DEPENDENCY_REPORT.MD',
      'PROJECT_VALIDATION.MD',
      'ENGINEERING_CERTIFICATION.MD',
      'EVIDENCE_MANIFEST.JSON'
    ];

    const currentPathsUpper = files.map(f => f.path.toUpperCase());
    const foundDiagnostics = internalDiagnosticFiles.filter(r =>
      currentPathsUpper.includes(r) ||
      currentPathsUpper.includes(`.DIAGNOSTICS/${r}`) ||
      currentPathsUpper.some(p => p.endsWith(`/${r}`))
    );

    const hasLeakedDiagnostics = files.some(f => {
      const pUpper = f.path.toUpperCase();
      return internalDiagnosticFiles.some(r => pUpper.endsWith(r));
    });

    return {
      passed: !hasLeakedDiagnostics,
      presentReports: foundDiagnostics,
      missingReports: []
    };
  }

  /**
   * 3. Validate Documentation
   */
  public static validateDocumentation(files: ProjectFile[]): {
    passed: boolean;
    presentDocs: string[];
    missingDocs: string[];
  } {
    const requiredDocs = [
      'README.md',
      'ARCHITECTURE.md',
      'SECURITY.md',
      'DEPLOYMENT.md',
      'API_REFERENCE.md',
      'CLIENT_HANDOVER.md',
      'DEVELOPER_GUIDE.md',
      'TESTING_GUIDE.md',
      'CHANGELOG.md',
      'LICENSE',
      'KNOWLEDGE_INDEX.md'
    ];

    const currentPathsUpper = files.map(f => f.path.toUpperCase());
    const presentDocs = requiredDocs.filter(d => currentPathsUpper.includes(d.toUpperCase()));
    const missingDocs = requiredDocs.filter(d => !presentDocs.includes(d));

    return {
      passed: missingDocs.length === 0,
      presentDocs,
      missingDocs
    };
  }

  /**
   * 4. Validate Artifacts
   */
  public static validateArtifacts(files: ProjectFile[], profile?: any): { passed: boolean; artifactsCount: number; status?: 'PASS' | 'FAIL' | 'NOT_APPLICABLE' | 'NOT_VERIFIED' } {
    const artifactFiles = files.filter(f =>
      f.path.includes('artifacts/') ||
      f.path.endsWith('.json') ||
      f.path.endsWith('.abi')
    );
    const buildArtifacts = artifactFiles.filter(f =>
      !f.path.toUpperCase().endsWith('MANIFEST.JSON') &&
      !f.path.toUpperCase().endsWith('EVIDENCE_MANIFEST.JSON')
    );
    const validArtifacts = buildArtifacts.filter(f => f.content && f.content.trim().length > 0);

    const isRequired = profile?.artifactsRequired === true || profile?.requiresArtifacts === true;

    if (buildArtifacts.length === 0) {
      if (isRequired) {
        return { passed: false, artifactsCount: 0, status: 'FAIL' };
      }
      return { passed: true, artifactsCount: 0, status: 'NOT_APPLICABLE' };
    }

    const passed = validArtifacts.length === buildArtifacts.length;
    return {
      passed,
      artifactsCount: validArtifacts.length,
      status: passed ? 'PASS' : 'FAIL'
    };
  }

  /**
   * Validate export package consistency and integrity
   */
  public static validatePackageConsistency(files: ProjectFile[]): { passed: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const f of files) {
      const pUpper = f.path.toUpperCase();
      const content = f.content || '';

      if (pUpper.startsWith('.DIAGNOSTICS/')) {
        issues.push(`Forbidden internal diagnostic file in export package: ${f.path}`);
      }

      if (
        content.includes('PROVIDER_ERROR') ||
        content.includes('RATE_LIMIT_ERROR') ||
        content.includes('CONTEXT_TOKEN_ERROR')
      ) {
        issues.push(`Export package file ${f.path} contains unhandled provider errors.`);
      }

      if (!pUpper.endsWith('.EXAMPLE') && !pUpper.endsWith('.MD') && !pUpper.endsWith('.TXT')) {
        if (/PRIVATE_KEY\s*=\s*0x[a-fA-F0-9]{64}/.test(content)) {
          issues.push(`Export package file ${f.path} contains exposed private key.`);
        }
        if (pUpper.endsWith('.SOL') || pUpper.endsWith('.RS') || pUpper.endsWith('.MOVE')) {
          if (content.includes('```')) {
            issues.push(`Export package code file ${f.path} contains markdown code fences, representing malformed source.`);
          }
        }
      }
    }

    return {
      passed: issues.length === 0,
      issues
    };
  }

  /**
   * 5. Validate Deployment Assets
   */
  public static validateDeploymentAssets(
    files: ProjectFile[],
    deploymentResult?: any
  ): { passed: boolean; presentAssets: string[] } {
    const assets = files.filter(f =>
      f.path.includes('script/') ||
      f.path.includes('deploy/') ||
      f.path.includes('DEPLOYMENT') ||
      f.path.endsWith('.env.example')
    ).map(f => f.path);

    const hasAuthoritativeEvidence = !!(
      deploymentResult &&
      (deploymentResult.deploymentId || deploymentResult.reportMarkdown || deploymentResult.stateHistory || deploymentResult.state) &&
      (deploymentResult.state === 'COMPLETED' || deploymentResult.status === 'PASS' || deploymentResult.passed === true)
    );

    return {
      passed: hasAuthoritativeEvidence,
      presentAssets: assets
    };
  }

  /**
   * 6. Generate Manifest (MANIFEST.json)
   */
  public static generateManifest(
    files: ProjectFile[],
    projectName: string,
    blockchain: string,
    framework: string = 'UNKNOWN',
    compilerVersion: string = 'UNKNOWN'
  ): string {
    const codeFiles = files.filter(f => f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move'));
    const detectedLanguage = codeFiles.some(f => f.path.endsWith('.rs')) ? 'Rust' : codeFiles.some(f => f.path.endsWith('.move')) ? 'Move' : codeFiles.some(f => f.path.endsWith('.sol')) ? 'Solidity' : 'UNKNOWN';

    const actualReports = files.filter(f => f.path.includes('REPORT')).map(f => f.path);
    const actualDocs = files.filter(f => f.path.endsWith('.md') && !f.path.includes('REPORT') && !f.path.includes('diagrams/')).map(f => f.path);
    const actualDiagrams = files.filter(f => f.path.includes('diagrams/')).map(f => f.path);
    const actualArtifacts = files.filter(f => f.path.includes('artifacts/')).map(f => f.path);

    const manifest = {
      project: projectName,
      blockchain: blockchain,
      framework: framework,
      compiler: compilerVersion,
      language: detectedLanguage,
      version: 'v1.0.0-rc2',
      timestamp: new Date().toISOString(),
      artifacts: actualArtifacts,
      reports: actualReports,
      documentation: actualDocs,
      diagrams: actualDiagrams,
      generatedFilesCount: files.length,
      hashes: files.reduce((acc, f) => {
        acc[f.path] = this.computeSha256(f.content);
        return acc;
      }, {} as Record<string, string>)
    };

    return JSON.stringify(manifest, null, 2);
  }

  /**
   * 7. Generate Checksums (CHECKSUMS.txt)
   */
  public static generateChecksums(files: ProjectFile[]): string {
    return files
      .map(f => `${this.computeSha256(f.content)}  ${f.path}`)
      .sort()
      .join('\n') + '\n';
  }

  /**
   * 8. Generate Version File (VERSION.txt)
   */
  public static generateVersionFile(version: string = 'v1.0.0-rc2'): string {
    return `Project Version: ${version}
Build Environment: AI Studio Enterprise Engineering Core
Release Target: Enterprise Client Delivery
Build Timestamp: ${new Date().toISOString()}
`;
  }

  /**
   * 9. Generate Delivery Summary (DELIVERY_SUMMARY.md)
   */
  public static generateDeliverySummary(
    files: ProjectFile[],
    projectName: string,
    blockchain: string,
    exportResult: any,
    isCertified: boolean = false
  ): string {
    let readinessStatus = 'UNKNOWN / NOT_VERIFIED';
    let clientCertified = 'UNKNOWN / NOT_VERIFIED';

    if (isCertified) {
      if (exportResult && exportResult.exportCertified && exportResult.status === 'PASS') {
        readinessStatus = '✅ PASSED & CERTIFIED FOR CLIENT DELIVERY';
        clientCertified = 'YES';
      } else {
        readinessStatus = '❌ BLOCKED';
        clientCertified = 'NO';
      }
    }

    return `# Enterprise Client Delivery Summary & Package Inspection Report

**Project Name:** ${projectName}
**Target Blockchain Network:** ${blockchain}
**Release Version:** v1.0.0-rc2
**Delivery Readiness Status:** ${readinessStatus}
**Execution Date:** ${new Date().toISOString()}

---

## 1. Project Overview & Architecture
The **${projectName}** smart contract codebase has been prepared for delivery on ${blockchain}.
${isCertified && exportResult && exportResult.exportCertified && exportResult.status === 'PASS'
  ? 'This delivery package has passed all automated engineering gates and is certified for client delivery.'
  : 'This package is currently pending, unverified, or blocked by unverified/failed engineering gates.'}

---

## 2. Executive Status Summary
- Total Exported Files: ${files.length}
- Target Blockchain: ${blockchain}
- Client Delivery Certified: ${clientCertified}
`;
  }

  /**
   * 10. Generate Export Package Files
   */
  public static generateExport(
    files: ProjectFile[],
    projectName: string,
    prompt: string,
    blockchain: string,
    framework: string = 'Foundry/Anchor/Move'
  ): { files: ProjectFile[]; exportSuccess: boolean; issues: string[] } {
    const certResult = this.certifyExport(files, projectName, prompt, blockchain, framework);
    return {
      files: certResult.exportedFiles,
      exportSuccess: certResult.exportCertified,
      issues: certResult.issues
    };
  }

  /**
   * 11. Certify Export Package
   */
  public static certifyExport(
    files: ProjectFile[],
    projectName: string,
    prompt: string,
    blockchain: string,
    framework: string = 'UNKNOWN',
    options?: {
      compilationResult?: any;
      testingResult?: any;
      securityAuditResult?: any;
      dependencyResult?: any;
      architectureResult?: any;
      documentationResult?: any;
      deploymentResult?: any;
      compilerVersion?: string;
      projectProfile?: any;
    }
  ): ExportCertificationResult {
    const issues: string[] = [];

    // 1. Validate the export package
    const wsCheck = this.validateWorkspace(files);
    if (!wsCheck.passed) issues.push(...wsCheck.issues);

    // Prepare clean set of project files excluding internal diagnostics
    const internalReportNames = new Set([
      'QUALITY_REPORT.MD',
      'COMPILATION_REPORT.MD',
      'SECURITY_REPORT.MD',
      'ARCHITECTURE_REPORT.MD',
      'TEST_REPORT.MD',
      'TEST_COVERAGE.MD',
      'DOCUMENTATION_REPORT.MD',
      'DEPLOYMENT_REPORT.MD',
      'DEPENDENCY_REPORT.MD',
      'PROJECT_VALIDATION.MD',
      'ENGINEERING_CERTIFICATION.MD',
      'EVIDENCE_MANIFEST.JSON'
    ]);

    let exportedFiles = files.filter(f => {
      const pUpper = f.path.toUpperCase();
      if (pUpper.startsWith('.DIAGNOSTICS/')) return false;
      if (internalReportNames.has(pUpper)) return false;
      if (pUpper.startsWith('REPORTS/') && internalReportNames.has(pUpper.replace('REPORTS/', ''))) return false;
      return true;
    });

    // Generate Version File
    const versionTxt = this.generateVersionFile();
    const vIdx = exportedFiles.findIndex(f => f.path.toUpperCase() === 'VERSION.TXT');
    if (vIdx >= 0) exportedFiles[vIdx] = { path: 'VERSION.txt', content: versionTxt, language: 'text' };
    else exportedFiles.push({ path: 'VERSION.txt', content: versionTxt, language: 'text' });

    // Validate gates
    const reportsCheck = this.validateReports(exportedFiles);
    const docsCheck = this.validateDocumentation(exportedFiles);
    const artifactsCheck = this.validateArtifacts(exportedFiles, options?.projectProfile);
    const deployCheck = this.validateDeploymentAssets(exportedFiles, options?.deploymentResult);
    const pkgCheck = this.validatePackageConsistency(exportedFiles);
    if (!pkgCheck.passed) issues.push(...pkgCheck.issues);

    const validationGatesPassed = {
      workspace: wsCheck.passed,
      integrity: wsCheck.passed,
      dependencies: options?.dependencyResult ? (options.dependencyResult.overallStatus === 'PASS') : false,
      compiler: options?.compilationResult ? (options.compilationResult.status === 'PASS' && options.compilationResult.verificationMode === 'REAL_EXECUTION' && typeof options.compilationResult.exitCode === 'number' && options.compilationResult.exitCode === 0) : false,
      security: options?.securityAuditResult ? ((options.securityAuditResult.criticalCount ?? 0) === 0 && (options.securityAuditResult.highCount ?? 0) === 0 && (options.securityAuditResult.overallStatus === 'PASS' || options.securityAuditResult.status === 'CERTIFIED_SECURE' || options.securityAuditResult.status === 'PASS')) : false,
      deployment: deployCheck.passed,
      architecture: options?.architectureResult ? ((options.architectureResult.architecturePassed === true || options.architectureResult.status === 'PASS') && !!(options.architectureResult.requirements || options.architectureResult.comparison || options.architectureResult.scoreBreakdown || options.architectureResult.reportMarkdown)) : false,
      testing: options?.testingResult ? (options.testingResult.status === 'PASS' && options.testingResult.verificationMode === 'REAL_EXECUTION' && typeof options.testingResult.exitStatus === 'number' && options.testingResult.exitStatus === 0) : false,
      documentation: options?.documentationResult ? ((options.documentationResult.documentationPassed === true || options.documentationResult.status === 'PASS') && !!(options.documentationResult.reportMarkdown || options.documentationResult.certifiedFiles)) : docsCheck.passed
    };

    const reportsPresentCount = reportsCheck.presentReports.length;
    const docsPresentCount = docsCheck.presentDocs.length;

    // Calculate the actual count from the exported files.
    const diagramsPresentCount = exportedFiles.filter(file =>
      file.path.toLowerCase().includes('diagrams/')
    ).length;

    // 2. Determine the actual export status
    const exportCertified = issues.length === 0 &&
      reportsCheck.passed &&
      docsCheck.passed &&
      pkgCheck.passed &&
      artifactsCheck.passed &&
      wsCheck.passed;

    let status: 'PASS' | 'FAIL' | 'NOT_VERIFIED' = 'PASS';
    if (!files || files.length === 0) {
      status = 'NOT_VERIFIED';
    } else if (issues.length > 0 || !reportsCheck.passed || !docsCheck.passed || !pkgCheck.passed || !artifactsCheck.passed || !wsCheck.passed) {
      status = 'FAIL';
    }

    // 3. Build the ExportCertificationResult (without placeholder manifest/checksums/delivery summary)
    const result: ExportCertificationResult = {
      exportCertified,
      exportedFiles,
      manifestJson: '',
      checksumsTxt: '',
      deliverySummaryMd: '',
      versionTxt,
      reportsPresentCount,
      docsPresentCount,
      diagramsPresentCount,
      validationGatesPassed,
      issues,
      status
    };

    // 4. Generate the delivery summary from the actual result
    const deliverySummaryMd = this.generateDeliverySummary(exportedFiles, projectName, blockchain, result, false);
    result.deliverySummaryMd = deliverySummaryMd;

    const sIdx = exportedFiles.findIndex(f => f.path.toUpperCase() === 'DELIVERY_SUMMARY.MD');
    if (sIdx >= 0) exportedFiles[sIdx] = { path: 'DELIVERY_SUMMARY.md', content: deliverySummaryMd, language: 'markdown' };
    else exportedFiles.push({ path: 'DELIVERY_SUMMARY.md', content: deliverySummaryMd, language: 'markdown' });

    // Generate Manifest and Checksums from the actual final files
    const compilerVersion = options?.compilerVersion || options?.compilationResult?.compilerVersion || 'UNKNOWN';
    const fw = framework !== 'Foundry/Anchor/Move' && framework ? framework : (options?.compilationResult?.framework || 'UNKNOWN');

    const manifestJson = this.generateManifest(exportedFiles, projectName, blockchain, fw, compilerVersion);
    result.manifestJson = manifestJson;
    const mIdx = exportedFiles.findIndex(f => f.path.toUpperCase() === 'MANIFEST.JSON');
    if (mIdx >= 0) exportedFiles[mIdx] = { path: 'MANIFEST.json', content: manifestJson, language: 'json' };
    else exportedFiles.push({ path: 'MANIFEST.json', content: manifestJson, language: 'json' });

    const checksumsTxt = this.generateChecksums(exportedFiles);
    result.checksumsTxt = checksumsTxt;
    const cIdx = exportedFiles.findIndex(f => f.path.toUpperCase() === 'CHECKSUMS.TXT');
    if (cIdx >= 0) exportedFiles[cIdx] = { path: 'CHECKSUMS.txt', content: checksumsTxt, language: 'text' };
    else exportedFiles.push({ path: 'CHECKSUMS.txt', content: checksumsTxt, language: 'text' });

    result.exportedFiles = exportedFiles;

    // 5. Return the final result
    return result;
  }

  /**
   * Alias for certifyExport
   */
  public static certify(
    files: ProjectFile[],
    projectName: string = 'SmartContractProject',
    blockchain: string = 'ethereum',
    prompt: string = '',
    framework: string = 'UNKNOWN',
    options?: any
  ) {
    if (!Array.isArray(files)) throw new Error("ExportEngine.certify: files must be an array");
    const cert = this.certifyExport(files, projectName, prompt, blockchain, framework, options);
    if (!cert || !cert.exportedFiles) throw new Error("ExportEngine returned invalid result");
    return cert;
  }

  /**
   * Alias for certifyExport
   */
  public static export(
    files: ProjectFile[],
    projectName: string = 'SmartContractProject',
    blockchain: string = 'ethereum',
    prompt: string = '',
    framework: string = 'UNKNOWN',
    options?: any
  ) {
    return this.certify(files, projectName, blockchain, prompt, framework, options);
  }
}
