import { ProjectFile } from '../../../types';
import { ExportCertificationResult } from '../export/ExportEngine';
import { sha256 } from '../utils/cryptoFallback';
import { CompilationResult } from '../compiler/CompilerEngine';
import { TestingValidationResult } from '../testing/TestingValidationEngine';
import { SecurityAuditResult } from '../security/SecurityAuditEngine';
import { DependencyValidationResult } from '../validators/DependencyValidationEngine';
import { ArchitectureValidationResult } from '../architecture/ArchitectureValidationEngine';
import { DocumentationCertificationResult } from '../documentation/DocumentationEngine';
import { DeploymentResult } from '../deployment/DeploymentEngine';
import { MarkdownFenceStripper } from '../parsers/MarkdownFenceStripper';

export type GateVerificationStatus = 'PASS' | 'FAIL' | 'NOT_VERIFIED';

export interface GateStatus {
  name: string;
  status: GateVerificationStatus;
  passed: boolean;
  score: number;
  details: string;
  evidenceSource?: string;
  timestamp?: string;
}

export interface ValidationCollectorResults {
  workspace: GateStatus;
  integrity: GateStatus;
  dependencies: GateStatus;
  compiler: GateStatus;
  security: GateStatus;
  deployment: GateStatus;
  architecture: GateStatus;
  testing: GateStatus;
  documentation: GateStatus;
  exportGate: GateStatus;
}

export interface CertificationArtifacts {
  projectFiles: ProjectFile[];
  internalDiagnostics: ProjectFile[];
}

export interface CertificationEvidenceInput {
  compilationResult?: CompilationResult | any;
  testingResult?: TestingValidationResult | any;
  securityAuditResult?: SecurityAuditResult | any;
  dependencyResult?: DependencyValidationResult | any;
  architectureResult?: ArchitectureValidationResult | any;
  documentationResult?: DocumentationCertificationResult | any;
  deploymentResult?: DeploymentResult | any;
  exportResult?: ExportCertificationResult | any;
}

export interface CertificationOptions {
  projectId?: string;
  customCertificationId?: string;
  framework?: string;
  compilerVersion?: string;
  language?: string;
  compilationResult?: CompilationResult | any;
  testingResult?: TestingValidationResult | any;
  securityAuditResult?: SecurityAuditResult | any;
  dependencyResult?: DependencyValidationResult | any;
  architectureResult?: ArchitectureValidationResult | any;
  documentationResult?: DocumentationCertificationResult | any;
  deploymentResult?: DeploymentResult | any;
  exportResult?: ExportCertificationResult | any;
  evidence?: CertificationEvidenceInput;
}

export interface CertificationData {
  projectName: string;
  projectId: string;
  certificationId: string;
  timestamp: string;
  engineVersions: Record<string, string>;
  blockchain: string;
  framework: string;
  compiler: string;
  language: string;
  generatedContractsCount: number;
  generatedTestsCount: number;
  generatedDocsCount: number;
  generatedReportsCount: number;
  validationTimeline: Array<{ gate: string; timestamp: string; durationMs: number | null; status: GateVerificationStatus }>;
  gates: ValidationCollectorResults;
  certificationScore: number;
  overallGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  finalRecommendation: string;
  clientDeliveryStatus: 'CERTIFIED & APPROVED FOR CLIENT DELIVERY' | 'BLOCKED - GATES FAILED' | 'BLOCKED - EVIDENCE MISSING OR UNVERIFIED';
  executionEvidence: any;
}

export interface EngineeringCertificationResult {
  isCertified: boolean;
  status: 'CERTIFIED' | 'FAILED' | 'NOT_VERIFIED';
  certifiedFiles: ProjectFile[];
  internalDiagnostics: ProjectFile[];
  artifacts: CertificationArtifacts;
  certificateMd: string;
  evidenceManifestJson: string;
  certificationId: string;
  projectId: string;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  score: number;
  executiveSummary: string;
  issues: string[];
}

export class EngineeringCertificationEngine {
  public static generateUuid(): string {
    const randomHex = Array.from({ length: 16 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('').toUpperCase();
    return 'CERT-' + randomHex;
  }

  public static collectWorkspaceStatus(files: ProjectFile[]): GateStatus {
    const hasFiles = files && files.length > 0;
    const hasContract = files && files.some(f =>
      f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move') || f.path.endsWith('.ts')
    );
    const passed = hasFiles && hasContract;
    const status: GateVerificationStatus = passed ? 'PASS' : 'FAIL';
    return {
      name: 'Workspace Preservation Engine',
      status,
      passed,
      score: passed ? 100 : 0,
      details: passed ? `Workspace validated with ${files.length} persistent project files.` : 'Workspace is missing source contract files.'
    };
  }

  public static collectProjectIntegrityStatus(files: ProjectFile[]): GateStatus {
    if (!files || files.length === 0) {
      return {
        name: 'Project Integrity Engine',
        status: 'FAIL',
        passed: false,
        score: 0,
        details: 'Project integrity check failed: empty file array.'
      };
    }

    const hasRootFiles = files.some(f => f.path.includes('/')) || files.length >= 2;
    const hasNoEmptyFiles = files.every(f => f.content && f.content.trim().length > 0);

    let hasLeakage = false;
    let leakageDetails = '';
    const codeFiles = files.filter(f => f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move') || f.path.endsWith('.ts'));
    for (const file of codeFiles) {
      const contentToCheck = file.content ? MarkdownFenceStripper.strip(file.content, file.path) : '';
      if (contentToCheck.trim().startsWith('{') || contentToCheck.trim().startsWith('[')) {
        hasLeakage = true;
        leakageDetails = `JSON leakage detected in ${file.path}`;
      }
      if (contentToCheck.includes('```')) {
        hasLeakage = true;
        leakageDetails = `Markdown leakage detected in ${file.path}`;
      }
    }

    const passed = hasRootFiles && hasNoEmptyFiles && !hasLeakage;
    const status: GateVerificationStatus = passed ? 'PASS' : 'FAIL';
    return {
      name: 'Project Integrity Engine',
      status,
      passed,
      score: passed ? 100 : 0,
      details: passed ? 'Project structural integrity and file paths verified.' : `Project integrity check failed: ${leakageDetails || 'empty files or broken layout.'}`
    };
  }

  public static collectDependencyStatus(dependencyResult?: DependencyValidationResult): GateStatus {
    if (!dependencyResult) {
      return {
        name: 'Dependency Validation Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Dependency validation evidence missing (NOT_VERIFIED).'
      };
    }

    if (dependencyResult.overallStatus === 'WARN') {
      return {
        name: 'Dependency Validation Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: `Dependency validation warning (NOT_VERIFIED): ${dependencyResult.warnings ? dependencyResult.warnings.join('; ') : 'warnings detected'}`
      };
    }

    const passed = dependencyResult.overallStatus === 'PASS';
    const status: GateVerificationStatus = passed ? 'PASS' : 'FAIL';
    return {
      name: 'Dependency Validation Engine',
      status,
      passed,
      score: passed ? 100 : 0,
      details: passed
        ? `Toolchain dependencies verified for ${dependencyResult.projectName} (${dependencyResult.checks ? dependencyResult.checks.length : 0} checks passed).`
        : `Dependency validation failed with warnings/errors: ${(dependencyResult as any).errors ? (dependencyResult as any).errors.join('; ') : (dependencyResult.warnings ? dependencyResult.warnings.join('; ') : 'errors detected')}`
    };
  }

  public static collectCompilerResults(compilationResult?: CompilationResult): GateStatus {
    if (!compilationResult || compilationResult.status === 'NOT_VERIFIED') {
      return {
        name: 'Compiler Intelligence Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Compilation evidence missing or toolchain unavailable (NOT_VERIFIED).'
      };
    }

    const isRealExecution = compilationResult.verificationMode === 'REAL_EXECUTION';
    const hasValidExitCode = typeof compilationResult.exitCode === 'number';

    if (
      compilationResult.status === 'PASS' &&
      isRealExecution &&
      hasValidExitCode &&
      compilationResult.exitCode === 0
    ) {
      return {
        name: 'Compiler Intelligence Engine',
        status: 'PASS',
        passed: true,
        score: 100,
        details: `Compiler build verified (${compilationResult.stdout || '0 errors'}).`
      };
    }

    if (compilationResult.status === 'PASS' && (!isRealExecution || !hasValidExitCode)) {
      return {
        name: 'Compiler Intelligence Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Compiler evidence incomplete or missing real execution mode / exit code (NOT_VERIFIED).'
      };
    }

    return {
      name: 'Compiler Intelligence Engine',
      status: 'FAIL',
      passed: false,
      score: 0,
      details: `Compiler build failed: ${compilationResult.stderr || 'compilation errors detected'}`
    };
  }

  public static collectTestingResults(testingResult?: TestingValidationResult): GateStatus {
    if (!testingResult || testingResult.verificationMode === 'TOOLCHAIN_UNAVAILABLE' || testingResult.status === 'NOT_VERIFIED') {
      return {
        name: 'Testing & QA Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Testing gate not verified: test toolchain unavailable or no test execution evidence provided (NOT_VERIFIED).'
      };
    }

    const isRealExecution = testingResult.verificationMode === 'REAL_EXECUTION';
    const hasValidExitStatus = typeof testingResult.exitStatus === 'number';

    if (
      testingResult.status === 'PASS' &&
      isRealExecution &&
      hasValidExitStatus &&
      testingResult.exitStatus === 0
    ) {
      const durationStr = testingResult.evidence?.durationMs != null ? `${testingResult.evidence.durationMs}ms` : 'UNKNOWN';
      return {
        name: 'Testing & QA Engine',
        status: 'PASS',
        passed: true,
        score: 100,
        details: `Real test execution passed (exit status 0, duration ${durationStr}).`
      };
    }

    if (testingResult.status === 'PASS' && (!isRealExecution || !hasValidExitStatus)) {
      return {
        name: 'Testing & QA Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Testing evidence incomplete or missing real execution mode / exit status (NOT_VERIFIED).'
      };
    }

    return {
      name: 'Testing & QA Engine',
      status: 'FAIL',
      passed: false,
      score: 0,
      details: `Real test execution failed with exit status ${testingResult.exitStatus ?? 'UNKNOWN'}. Stderr: ${testingResult.stderr || testingResult.stdout || 'no logs'}`
    };
  }

  public static collectSecurityResults(securityAuditResult?: SecurityAuditResult | any): GateStatus {
    if (!securityAuditResult || securityAuditResult.status === 'NOT_VERIFIED') {
      return {
        name: 'Enterprise Security Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Security audit evidence missing (NOT_VERIFIED).'
      };
    }

    const hasAuditEvidence = !!(
      securityAuditResult &&
      (securityAuditResult.reportMarkdown || securityAuditResult.findings || securityAuditResult.timestamp || securityAuditResult.analysisTimestamp)
    );
    const criticals = securityAuditResult.criticalCount ?? (securityAuditResult as any).criticalFindings ?? 0;
    const highs = securityAuditResult.highCount ?? (securityAuditResult as any).highFindings ?? 0;
    const isPassStatus = (securityAuditResult.status === 'CERTIFIED_SECURE' || securityAuditResult.overallStatus === 'PASS' || securityAuditResult.status === 'PASS') && (securityAuditResult.verified !== false);

    if (!hasAuditEvidence) {
      return {
        name: 'Enterprise Security Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Security audit evidence missing or audit not executed (NOT_VERIFIED).'
      };
    }

    if (isPassStatus && criticals === 0 && highs === 0) {
      return {
        name: 'Enterprise Security Engine',
        status: 'PASS',
        passed: true,
        score: 100,
        details: 'Security audit passed: 0 Critical / High vulnerabilities verified by SecurityAuditEngine.'
      };
    }

    if (securityAuditResult.status === 'DEPLOYMENT_BLOCKED' || criticals > 0 || highs > 0 || securityAuditResult.overallStatus === 'FAIL' || securityAuditResult.status === 'FAIL') {
      return {
        name: 'Enterprise Security Engine',
        status: 'FAIL',
        passed: false,
        score: 0,
        details: `Security audit failed: ${criticals} Critical, ${highs} High findings detected.`
      };
    }

    return {
      name: 'Enterprise Security Engine',
      status: 'NOT_VERIFIED',
      passed: false,
      score: 0,
      details: 'Security audit evidence incomplete (NOT_VERIFIED).'
    };
  }

  public static collectArchitectureResults(architectureResult?: ArchitectureValidationResult | any): GateStatus {
    if (!architectureResult) {
      return {
        name: 'Architecture Validation Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Architecture validation evidence missing (NOT_VERIFIED).'
      };
    }

    const hasAuthoritativeEvidence = !!(
      architectureResult &&
      architectureResult.requirements &&
      architectureResult.comparison &&
      architectureResult.scoreBreakdown
    );
    const isPassStatus = architectureResult.architecturePassed === true || architectureResult.status === 'PASS';

    if (isPassStatus && hasAuthoritativeEvidence) {
      return {
        name: 'Architecture Validation Engine',
        status: 'PASS',
        passed: true,
        score: 100,
        details: 'Architecture specification and business logic mapping verified.'
      };
    }

    if (isPassStatus && !hasAuthoritativeEvidence) {
      return {
        name: 'Architecture Validation Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Architecture validation evidence missing or incomplete (NOT_VERIFIED).'
      };
    }

    return {
      name: 'Architecture Validation Engine',
      status: 'FAIL',
      passed: false,
      score: 0,
      details: 'Architecture validation failed.'
    };
  }

  public static collectDocumentationResults(documentationResult?: DocumentationCertificationResult | any): GateStatus {
    if (!documentationResult) {
      return {
        name: 'Documentation Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Documentation validation evidence missing (NOT_VERIFIED).'
      };
    }

    const hasAuthoritativeEvidence = !!(
      documentationResult &&
      (documentationResult.docReportGenerated === true ||
        documentationResult.knowledgeIndexGenerated === true ||
        (documentationResult.reportMarkdown && documentationResult.certifiedFiles && documentationResult.certifiedFiles.length > 0))
    );
    const isPassStatus = documentationResult.documentationPassed === true || documentationResult.status === 'PASS';

    if (isPassStatus && hasAuthoritativeEvidence) {
      return {
        name: 'Documentation Engine',
        status: 'PASS',
        passed: true,
        score: 100,
        details: 'Documentation suite verified by DocumentationEngine.'
      };
    }

    if (isPassStatus && !hasAuthoritativeEvidence) {
      return {
        name: 'Documentation Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Documentation validation evidence missing or incomplete (NOT_VERIFIED).'
      };
    }

    return {
      name: 'Documentation Engine',
      status: 'FAIL',
      passed: false,
      score: 0,
      details: 'Documentation gate failed: missing required guides.'
    };
  }

  public static collectDeploymentResults(deploymentResult?: DeploymentResult | any): GateStatus {
    if (!deploymentResult) {
      return {
        name: 'Deployment Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Deployment validation evidence missing (NOT_VERIFIED).'
      };
    }

    const hasAuthoritativeEvidence = !!(
      deploymentResult &&
      (deploymentResult.deploymentId || deploymentResult.reportMarkdown || deploymentResult.stateHistory || deploymentResult.state)
    );
    const isPassStatus = (deploymentResult.state === 'COMPLETED' || deploymentResult.status === 'PASS' || deploymentResult.preChecks?.passed === true) && !!(deploymentResult.reportMarkdown || deploymentResult.preChecks);

    if (isPassStatus && hasAuthoritativeEvidence) {
      return {
        name: 'Deployment Engine',
        status: 'PASS',
        passed: true,
        score: 100,
        details: deploymentResult.state === 'COMPLETED' ? 'Actual deployment execution evidence verified.' : 'Deployment readiness pre-check evidence verified; no on-chain deployment is claimed.'
      };
    }

    if (!hasAuthoritativeEvidence) {
      return {
        name: 'Deployment Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Deployment validation evidence missing or unverified (NOT_VERIFIED).'
      };
    }

    return {
      name: 'Deployment Engine',
      status: 'FAIL',
      passed: false,
      score: 0,
      details: 'Deployment validation failed: missing scripts or invalid configuration.'
    };
  }

  public static collectExportResults(exportResult?: ExportCertificationResult | any, authoritativeGates?: Record<string, any>): GateStatus {
    if (!exportResult) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package certification evidence missing (NOT_VERIFIED).'
      };
    }

    if (exportResult.status === 'FAIL') {
      return {
        name: 'Export Certification Engine',
        status: 'FAIL',
        passed: false,
        score: 0,
        details: `Export gate failed: ${(exportResult.issues || []).join('; ')}`
      };
    }

    if (!exportResult.status) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package certification evidence incomplete: missing status (NOT_VERIFIED).'
      };
    }

    if (exportResult.status === 'NOT_VERIFIED') {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package certification is not verified (NOT_VERIFIED).'
      };
    }

    if (exportResult.status !== 'PASS') {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: `Export package status is invalid: ${exportResult.status} (NOT_VERIFIED).`
      };
    }

    if (exportResult.exportCertified !== true) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package is not certified (exportCertified is not true).'
      };
    }

    if (!exportResult.exportedFiles || !Array.isArray(exportResult.exportedFiles) || exportResult.exportedFiles.length === 0) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package is missing exported files.'
      };
    }

    if (typeof exportResult.manifestJson !== 'string' || exportResult.manifestJson.trim().length === 0) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package is missing manifestJson.'
      };
    }

    if (typeof exportResult.checksumsTxt !== 'string' || exportResult.checksumsTxt.trim().length === 0) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package is missing checksumsTxt.'
      };
    }

    const normalizePath = (p: string): string => {
      let np = p.replace(/\\/g, '/');
      if (np.startsWith('./')) np = np.substring(2);
      return np;
    };

    // ISSUE 2 — MANIFEST.json file content in exportedFiles MUST match exportResult.manifestJson
    const manifestFiles = exportResult.exportedFiles.filter((f: any) =>
      normalizePath(f.path).toUpperCase() === 'MANIFEST.JSON'
    );
    if (manifestFiles.length === 0) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Missing MANIFEST.json in exported files.'
      };
    }
    if (manifestFiles.length > 1) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Duplicate MANIFEST.json files found in exported files.'
      };
    }
    if (manifestFiles[0].content !== exportResult.manifestJson) {
      return {
        name: 'Export Certification Engine',
        status: 'FAIL',
        passed: false,
        score: 0,
        details: 'MANIFEST.json file content in exportedFiles does not match exportResult.manifestJson.'
      };
    }

    // ISSUE 3 — CHECKSUMS.txt file content in exportedFiles MUST match exportResult.checksumsTxt
    const checksumFiles = exportResult.exportedFiles.filter((f: any) =>
      normalizePath(f.path).toUpperCase() === 'CHECKSUMS.TXT'
    );
    if (checksumFiles.length === 0) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Missing CHECKSUMS.txt in exported files.'
      };
    }
    if (checksumFiles.length > 1) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Duplicate CHECKSUMS.txt files found in exported files.'
      };
    }
    if (checksumFiles[0].content !== exportResult.checksumsTxt) {
      return {
        name: 'Export Certification Engine',
        status: 'FAIL',
        passed: false,
        score: 0,
        details: 'CHECKSUMS.txt file content in exportedFiles does not match exportResult.checksumsTxt.'
      };
    }

    let manifest: any;
    try {
      manifest = JSON.parse(exportResult.manifestJson);
    } catch (e) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package manifestJson parsing failed (NOT_VERIFIED).'
      };
    }

    if (!manifest || typeof manifest !== 'object' || !manifest.hashes || typeof manifest.hashes !== 'object') {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package manifest is missing or incomplete (NOT_VERIFIED).'
      };
    }

    const exportedPaths = exportResult.exportedFiles.map((f: any) => f.path);
    const seenPaths = new Set<string>();
    for (const p of exportedPaths) {
      const norm = normalizePath(p).toLowerCase();
      if (seenPaths.has(norm)) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Duplicate file path in exported files: ${p}`
        };
      }
      seenPaths.add(norm);
    }

    if (exportedPaths.some(p => p.includes('.diagnostics'))) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Internal .diagnostics files must not be present in exported files.'
      };
    }

    const manifestHashesKeys = Object.keys(manifest.hashes);
    if (manifestHashesKeys.some(p => p.includes('.diagnostics'))) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Internal .diagnostics files must not be present in manifest.'
      };
    }

    const isMetaFile = (p: string): boolean => {
      const norm = normalizePath(p).toUpperCase();
      return norm === 'MANIFEST.JSON' || norm === 'CHECKSUMS.TXT';
    };

    if (manifestHashesKeys.some(p => isMetaFile(p))) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Manifest hashes must not contain MANIFEST.json or CHECKSUMS.txt.'
      };
    }

    const coreExportedPathsNormalized = new Set<string>(
      exportedPaths.map(p => normalizePath(p).toLowerCase()).filter(p => !isMetaFile(p))
    );
    const manifestHashesKeysNormalized = new Set<string>(
      manifestHashesKeys.map(p => normalizePath(p).toLowerCase())
    );

    if (manifestHashesKeysNormalized.size !== manifestHashesKeys.length) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Duplicate file paths exist in manifest hashes.'
      };
    }

    if (coreExportedPathsNormalized.size !== manifestHashesKeysNormalized.size) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: `Integrity verification mismatch: Package holds ${coreExportedPathsNormalized.size} core files, but manifest indexes ${manifestHashesKeysNormalized.size}.`
      };
    }

    for (const p of manifestHashesKeysNormalized) {
      if (!coreExportedPathsNormalized.has(p)) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Manifest lists file '${p}' which does not exist in exported files.`
        };
      }
    }

    for (const p of coreExportedPathsNormalized) {
      if (!manifestHashesKeysNormalized.has(p)) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Exported file '${p}' is missing from manifest.`
        };
      }
    }

    // Cryptographic validation of every manifest hash entry
    const exportedFileMap = new Map<string, any>();
    for (const f of exportResult.exportedFiles) {
      exportedFileMap.set(normalizePath(f.path).toLowerCase(), f);
    }

    for (const [rawPath, declaredHash] of Object.entries(manifest.hashes)) {
      const normPath = normalizePath(rawPath).toLowerCase();

      if (isMetaFile(normPath)) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Forbidden meta file '${rawPath}' found in manifest hashes.`
        };
      }

      if (typeof declaredHash !== 'string') {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Manifest hash value for '${rawPath}' is not a string.`
        };
      }

      const declaredHashTrimmed = (declaredHash as string).trim();
      if (!/^[a-fA-F0-9]{64}$/.test(declaredHashTrimmed)) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Manifest hash format for '${rawPath}' is invalid (must be exactly 64 hexadecimal characters).`
        };
      }

      const actualFile = exportedFileMap.get(normPath);
      if (!actualFile) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Manifest lists file '${rawPath}' which does not exist in exported files.`
        };
      }

      let actualHash: string;
      try {
        actualHash = sha256(actualFile.content).toLowerCase();
      } catch (e) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Failed to compute SHA-256 for '${rawPath}'.`
        };
      }

      if (actualHash !== declaredHashTrimmed.toLowerCase()) {
        return {
          name: 'Export Certification Engine',
          status: 'FAIL',
          passed: false,
          score: 0,
          details: `Manifest hash mismatch for '${rawPath}': calculated ${actualHash}, declared ${declaredHashTrimmed.toLowerCase()}`
        };
      }
    }

    const manifestLists = [manifest.artifacts, manifest.reports, manifest.documentation, manifest.diagrams];
    for (const list of manifestLists) {
      if (Array.isArray(list)) {
        const listSeen = new Set<string>();
        for (const p of list) {
          if (typeof p !== 'string') {
            return {
              name: 'Export Certification Engine',
              status: 'NOT_VERIFIED',
              passed: false,
              score: 0,
              details: 'Manifest file list contains non-string entry.'
            };
          }
          const norm = normalizePath(p).toLowerCase();
          if (listSeen.has(norm)) {
            return {
              name: 'Export Certification Engine',
              status: 'NOT_VERIFIED',
              passed: false,
              score: 0,
              details: `Duplicate path in manifest list: ${p}`
            };
          }
          listSeen.add(norm);
          const exportedPathsLower = new Set(exportedPaths.map(ep => normalizePath(ep).toLowerCase()));
          if (!exportedPathsLower.has(norm)) {
            return {
              name: 'Export Certification Engine',
              status: 'NOT_VERIFIED',
              passed: false,
              score: 0,
              details: `Manifest list references file '${p}' which does not exist in exported files.`
            };
          }
        }
      }
    }

    // 2. CHECKSUMS TXT VALIDATION
    const checksumPaths = new Set<string>();
    const checksumMap = new Map<string, string>();
    const lines = exportResult.checksumsTxt.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Checksums content is empty or unparsable.'
      };
    }

    for (const line of lines) {
      const match = line.match(/^([a-fA-F0-9]{64})\s+(.+)$/);
      if (!match) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: 'Checksums format is invalid or cannot be parsed.'
        };
      }
      const hash = match[1].toLowerCase();
      const path = match[2];
      const normPath = normalizePath(path).toLowerCase();
      if (normPath.toUpperCase() === 'CHECKSUMS.TXT') {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: 'CHECKSUMS.txt must not contain its own checksum entry.'
        };
      }
      if (checksumPaths.has(normPath)) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Duplicate path found in checksum entries: ${path}`
        };
      }
      checksumPaths.add(normPath);
      checksumMap.set(normPath, hash);
    }

    const hasChecksumsFileInExported = exportResult.exportedFiles.some((f: any) => normalizePath(f.path).toUpperCase() === 'CHECKSUMS.TXT');
    const expectedChecksumCount = hasChecksumsFileInExported ? exportResult.exportedFiles.length - 1 : exportResult.exportedFiles.length;

    if (checksumPaths.size !== expectedChecksumCount) {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Mismatch between number of checksum entries and number of exported files.'
      };
    }

    for (const file of exportResult.exportedFiles) {
      const normPath = normalizePath(file.path).toLowerCase();
      if (normPath.toUpperCase() === 'CHECKSUMS.TXT') continue;
      if (!checksumMap.has(normPath)) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `File missing from checksum list: ${file.path}`
        };
      }
      const calculatedHash = sha256(file.content).toLowerCase();
      const declaredHash = checksumMap.get(normPath);
      if (calculatedHash !== declaredHash) {
        return {
          name: 'Export Certification Engine',
          status: 'FAIL',
          passed: false,
          score: 0,
          details: `Checksum mismatch for file ${file.path}: calculated ${calculatedHash}, declared ${declaredHash}`
        };
      }
    }

    if (!exportResult.validationGatesPassed || typeof exportResult.validationGatesPassed !== 'object') {
      return {
        name: 'Export Certification Engine',
        status: 'NOT_VERIFIED',
        passed: false,
        score: 0,
        details: 'Export package validationGatesPassed is missing or invalid.'
      };
    }

    const requiredGates = ['workspace', 'integrity', 'dependencies', 'compiler', 'security', 'deployment', 'architecture', 'testing', 'documentation'];
    for (const gate of requiredGates) {
      if (!(gate in exportResult.validationGatesPassed) || exportResult.validationGatesPassed[gate] === undefined) {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Export package validation gate evidence incomplete: missing required gate '${gate}' (NOT_VERIFIED).`
        };
      }
      const value = exportResult.validationGatesPassed[gate];
      if (typeof value !== 'boolean') {
        return {
          name: 'Export Certification Engine',
          status: 'NOT_VERIFIED',
          passed: false,
          score: 0,
          details: `Export package validation gate '${gate}' value is not a boolean (NOT_VERIFIED).`
        };
      }
    }

    if (authoritativeGates) {
      for (const gate of requiredGates) {
        const authGate = authoritativeGates[gate];
        const authPassed = authGate && authGate.status === 'PASS';
        const summaryPassed = exportResult.validationGatesPassed[gate];
        if (summaryPassed === true && !authPassed) {
          const authStatus = authGate ? authGate.status : 'NOT_VERIFIED';
          if (authStatus === 'FAIL') {
            return {
              name: 'Export Certification Engine',
              status: 'FAIL',
              passed: false,
              score: 0,
              details: `Authoritative gate '${gate}' failed, but export summary claimed it passed.`
            };
          } else {
            return {
              name: 'Export Certification Engine',
              status: 'NOT_VERIFIED',
              passed: false,
              score: 0,
              details: `Authoritative gate '${gate}' is ${authStatus}, but export summary claimed it passed.`
            };
          }
        }
      }
    }

    return {
      name: 'Export Certification Engine',
      status: 'PASS',
      passed: true,
      score: 100,
      details: 'Export package certified.'
    };
  }

  public static calculateCertificationScore(gates: ValidationCollectorResults): number {
    const gateList = Object.values(gates);
    const passedCount = gateList.filter(g => g.status === 'PASS').length;

    return Math.round((passedCount / gateList.length) * 100);
  }

  public static calculateOverallGrade(score: number, allGatesPassed: boolean): 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' {
    if (!allGatesPassed) return 'F';
    if (score >= 97) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  public static generateExecutiveSummary(
    projectName: string,
    certificationId: string,
    score: number,
    grade: string,
    status: 'CERTIFIED' | 'FAILED' | 'NOT_VERIFIED',
    evidence: any
  ): string {
    return `# Executive Certification Summary for ${projectName}
**Certification ID:** ${certificationId}
**Overall Engineering Grade:** ${grade} (Certification Score: ${score}/100)
**Certification Status:** ${status}
**Client Delivery Status:** ${status === 'CERTIFIED' ? '■ CERTIFIED & APPROVED FOR CLIENT DELIVERY' : status === 'FAILED' ? '■ BLOCKED - GATES FAILED' : '■■ BLOCKED - EVIDENCE MISSING OR UNVERIFIED'}
**Timestamp:** ${new Date().toISOString()}

## Execution Evidence Summary
- Workspace ID: ${evidence.workspaceId}
- Compiler Evidence: ${evidence.compilerExitStatus}
- Test Execution Evidence: ${evidence.testExitStatus}
- Security Audit Evidence: ${evidence.auditResults}
`;
  }

  public static generateEvidenceManifest(files: ProjectFile[], certData: CertificationData): string {
    const manifest = {
      certificationId: certData.certificationId,
      projectId: certData.projectId,
      projectName: certData.projectName,
      timestamp: certData.timestamp,
      overallGrade: certData.overallGrade,
      certificationScore: certData.certificationScore,
      clientDeliveryStatus: certData.clientDeliveryStatus,
      compiler: certData.compiler,
      framework: certData.framework,
      language: certData.language,
      validationTimeline: certData.validationTimeline,
      gatesStatus: certData.gates,
      executionEvidence: certData.executionEvidence,
      fileChecksums: files.reduce((acc, f) => {
        acc[f.path] = sha256(f.content);
        return acc;
      }, {} as Record<string, string>)
    };
    return JSON.stringify(manifest, null, 2);
  }

  public static generateEngineeringCertificate(certData: CertificationData): string {
    return `# Enterprise Engineering Certificate of Quality & Release Readiness
**Project Name:** ${certData.projectName}
**Project ID:** ${certData.projectId}
**Certification ID:** ${certData.certificationId}
**Generation Timestamp:** ${certData.timestamp}
**Target Blockchain Network:** ${certData.blockchain}
**Framework & Compiler:** ${certData.framework} (${certData.compiler})

---

## 1. Executive Certification Overview
| Metric | Certified Value |
| :--- | :--- |
| **Overall Engineering Grade** | **${certData.overallGrade}** |
| **Certification Score** | **${certData.certificationScore} / 100** |
| **Client Delivery Readiness** | **${certData.clientDeliveryStatus}** |

## 2. Real Execution Evidence
- Workspace ID: ${certData.executionEvidence.workspaceId}
- Compiler Evidence: ${certData.executionEvidence.compilerExitStatus}
- Test Execution Evidence: ${certData.executionEvidence.testExitStatus}
- Security Audit Evidence: ${certData.executionEvidence.auditResults}

---

## 3. Comprehensive Validation Gate Matrix
| Gate Dimension | Status | Score | Verification Detail |
| :--- | :--- | :--- | :--- |
| **1. Workspace Preservation** | ${certData.gates.workspace.status === 'PASS' ? '■ PASS' : certData.gates.workspace.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.workspace.score}/100 | ${certData.gates.workspace.details} |
| **2. Project Integrity** | ${certData.gates.integrity.status === 'PASS' ? '■ PASS' : certData.gates.integrity.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.integrity.score}/100 | ${certData.gates.integrity.details} |
| **3. Dependency Validation** | ${certData.gates.dependencies.status === 'PASS' ? '■ PASS' : certData.gates.dependencies.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.dependencies.score}/100 | ${certData.gates.dependencies.details} |
| **4. Compiler Intelligence** | ${certData.gates.compiler.status === 'PASS' ? '■ PASS' : certData.gates.compiler.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.compiler.score}/100 | ${certData.gates.compiler.details} |
| **5. Enterprise Security Audit** | ${certData.gates.security.status === 'PASS' ? '■ PASS' : certData.gates.security.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.security.score}/100 | ${certData.gates.security.details} |
| **6. Deployment Readiness** | ${certData.gates.deployment.status === 'PASS' ? '■ PASS' : certData.gates.deployment.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.deployment.score}/100 | ${certData.gates.deployment.details} |
| **7. Architecture Logic Mapping** | ${certData.gates.architecture.status === 'PASS' ? '■ PASS' : certData.gates.architecture.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.architecture.score}/100 | ${certData.gates.architecture.details} |
| **8. Testing & QA Verification** | ${certData.gates.testing.status === 'PASS' ? '■ PASS' : certData.gates.testing.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.testing.score}/100 | ${certData.gates.testing.details} |
| **9. Documentation Suite** | ${certData.gates.documentation.status === 'PASS' ? '■ PASS' : certData.gates.documentation.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.documentation.score}/100 | ${certData.gates.documentation.details} |
| **10. Export Package Certification** | ${certData.gates.exportGate.status === 'PASS' ? '■ PASS' : certData.gates.exportGate.status === 'NOT_VERIFIED' ? '■■ NOT_VERIFIED' : '■ FAIL'} | ${certData.gates.exportGate.score}/100 | ${certData.gates.exportGate.details} |

---
`;
  }

  public static certifyProject(
    files: ProjectFile[],
    projectName: string,
    prompt: string,
    blockchain: string,
    options?: CertificationOptions
  ): EngineeringCertificationResult {
    if (!files || !Array.isArray(files) || files.length === 0) {
      throw new Error('WORKSPACE_INCOMPLETE: Workspace contains no project files.');
    }

    const projectId = options?.projectId || `PROJ-${projectName.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;
    const certificationId = options?.customCertificationId || this.generateUuid();
    const timestamp = new Date().toISOString();

    const compilationResult = options?.compilationResult || options?.evidence?.compilationResult;
    const testingResult = options?.testingResult || options?.evidence?.testingResult;
    const securityAuditResult = options?.securityAuditResult || options?.evidence?.securityAuditResult;
    const dependencyResult = options?.dependencyResult || options?.evidence?.dependencyResult;
    const architectureResult = options?.architectureResult || options?.evidence?.architectureResult;
    const documentationResult = options?.documentationResult || options?.evidence?.documentationResult;
    const deploymentResult = options?.deploymentResult || options?.evidence?.deploymentResult;
    const exportResult = options?.exportResult || options?.evidence?.exportResult;

    const framework = options?.framework || compilationResult?.framework || 'UNKNOWN';
    const compiler = compilationResult?.compilerVersion || options?.compilerVersion || 'UNKNOWN';
    const language = options?.language || (compilationResult as any)?.language || 'UNKNOWN';

    const gates: ValidationCollectorResults = {
      workspace: this.collectWorkspaceStatus(files),
      integrity: this.collectProjectIntegrityStatus(files),
      dependencies: this.collectDependencyStatus(dependencyResult),
      compiler: this.collectCompilerResults(compilationResult),
      security: this.collectSecurityResults(securityAuditResult),
      deployment: this.collectDeploymentResults(deploymentResult),
      architecture: this.collectArchitectureResults(architectureResult),
      testing: this.collectTestingResults(testingResult),
      documentation: this.collectDocumentationResults(documentationResult),
      exportGate: { name: 'Export Certification Engine', status: 'NOT_VERIFIED', passed: false, score: 0, details: '' }
    };

    gates.exportGate = this.collectExportResults(exportResult, gates);

    const gateArray = Object.values(gates);
    const hasFail = gateArray.some(g => g.status === 'FAIL');
    const allGatesPassed = gateArray.every(g => g.status === 'PASS');

    let status: 'CERTIFIED' | 'FAILED' | 'NOT_VERIFIED';
    if (allGatesPassed) status = 'CERTIFIED';
    else if (hasFail) status = 'FAILED';
    else status = 'NOT_VERIFIED';

    const isCertified = status === 'CERTIFIED';
    const score = this.calculateCertificationScore(gates);
    const grade = this.calculateOverallGrade(score, allGatesPassed);

    const generatedContractsCount = files.filter(f => f.path.endsWith('.sol') || f.path.endsWith('.rs') || f.path.endsWith('.move')).length;
    const generatedTestsCount = files.filter(f => f.path.includes('test') || f.path.includes('spec') || f.path.endsWith('.t.sol')).length;
    const generatedDocsCount = files.filter(f => f.path.endsWith('.md') && !f.path.includes('REPORT')).length;
    const generatedReportsCount = files.filter(f => f.path.includes('REPORT') || f.path.includes('SUMMARY') || f.path.includes('CERTIFICATION')).length;

    const fileHashes = files.reduce((acc, f) => {
      acc[f.path] = sha256(f.content);
      return acc;
    }, {} as Record<string, string>);

    const compilerExitStatus = compilationResult && typeof compilationResult.exitCode === 'number' ? `${compilationResult.exitCode} (${compilationResult.exitCode === 0 ? 'SUCCESS' : 'FAILED'})` : 'UNKNOWN';
    const testExitStatus = testingResult && typeof testingResult.exitStatus === 'number' ? `${testingResult.exitStatus} (${testingResult.exitStatus === 0 ? 'SUCCESS' : 'FAILED'})` : 'UNKNOWN';
    const testCommand = testingResult?.evidence?.command ? testingResult.evidence.command : 'UNKNOWN';

    const executionEvidence = {
      timestamp,
      workspaceId: projectId,
      filesInspected: files.length,
      compilerUsed: compiler,
      compilerVersion: compiler,
      compilerExitStatus,
      testCommand,
      testExitStatus,
      auditResults: securityAuditResult ? `${securityAuditResult.criticalCount ?? 0} Critical, ${securityAuditResult.highCount ?? 0} High, ${securityAuditResult.mediumCount ?? 0} Medium` : 'NOT_VERIFIED',
      finalFileHashes: fileHashes
    };

    const engineVersions: Record<string, string> = {
      CompilerEngine: 'v1.0.0',
      TestingEngine: 'v1.0.0',
      SecurityEngine: 'v1.0.0',
      CertificationEngine: 'v1.0.0'
    };

    const validationTimeline = gateArray.map(g => ({
      gate: g.name,
      timestamp,
      durationMs: (
        g.name.includes('Compiler') ? (compilationResult?.durationMs ?? null) :
        g.name.includes('Testing') ? (testingResult?.evidence?.durationMs ?? null) :
        g.name.includes('Security') ? ((securityAuditResult as any)?.analysisDurationMs ?? null) : null
      ),
      status: g.status
    }));

    const clientDeliveryStatus = isCertified ? 'CERTIFIED & APPROVED FOR CLIENT DELIVERY' : hasFail ? 'BLOCKED - GATES FAILED' : 'BLOCKED - EVIDENCE MISSING OR UNVERIFIED';

    const certData: CertificationData = {
      projectName,
      projectId,
      certificationId,
      timestamp,
      engineVersions,
      blockchain,
      framework,
      compiler,
      language,
      generatedContractsCount,
      generatedTestsCount,
      generatedDocsCount,
      generatedReportsCount,
      validationTimeline,
      gates,
      certificationScore: score,
      overallGrade: grade,
      finalRecommendation: isCertified
        ? `Codebase is 100% compliant with enterprise standards. Approved for production deployment and client delivery.`
        : `Certification blocked (${status}). Resolve all gate failures / missing evidence prior to client delivery.`,
      clientDeliveryStatus,
      executionEvidence
    };

    const certificateMd = this.generateEngineeringCertificate(certData);
    const evidenceManifestJson = this.generateEvidenceManifest(files, certData);
    const executiveSummary = this.generateExecutiveSummary(projectName, certificationId, score, grade, status, executionEvidence);

    const certifiedFiles = files.filter(f => !f.path.startsWith('.diagnostics/'));
    const internalDiagnostics: ProjectFile[] = [
      { path: '.diagnostics/ENGINEERING_CERTIFICATION.md', content: certificateMd, language: 'markdown' },
      { path: '.diagnostics/EVIDENCE_MANIFEST.json', content: evidenceManifestJson, language: 'json' }
    ];

    return {
      isCertified,
      status,
      certifiedFiles,
      internalDiagnostics,
      artifacts: { projectFiles: certifiedFiles, internalDiagnostics },
      certificateMd,
      evidenceManifestJson,
      certificationId,
      projectId,
      grade,
      score,
      executiveSummary,
      issues: gateArray.filter(g => g.status !== 'PASS').map(g => `${g.name} [${g.status}]: ${g.details}`)
    };
  }

  public static certify(files: ProjectFile[], projectName: string = 'SmartContractProject', blockchain: string = 'ethereum', prompt: string = '') {
    if (!Array.isArray(files)) throw new Error("EngineeringCertificationEngine.certify: files must be an array");
    const cert = this.certifyProject(files, projectName, prompt, blockchain);
    if (!cert || !cert.certifiedFiles) throw new Error("EngineeringCertificationEngine returned invalid result");
    return cert;
  }

  public static finalizeCertification(files: ProjectFile[], projectName: string = 'SmartContractProject', blockchain: string = 'ethereum', prompt: string = '') {
    return this.certify(files, projectName, blockchain, prompt);
  }
}
