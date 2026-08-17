import { ProjectFile } from '../../../types';
import { PatchEngine } from '../patch/PatchEngine';
import { DependencyValidationEngine } from '../validators/DependencyValidationEngine';
import { CompilerEngine } from '../compiler/CompilerEngine';

// Mocking AI Runtime interfaces since they must be supplied by your platform's actual backend services
export interface AIService {
  generateRemediationPatch(finding: SecurityFinding, fileContent: string): Promise<{ content: string; description: string }>;
}
export type SecuritySeverity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
export type SecurityConfidence = 'High' | 'Medium' | 'Low';
export interface SecurityFinding {
  id: string;
  title: string;
  blockchain: string;
  affectedFile: string;
  lineNumbers: number[];
  column: number;
  functionName: string;
  codeSnippet: string;
  severity: SecuritySeverity;
  confidence: SecurityConfidence;
  cwe: string;
  explanation: string;
  impact: string;
  recommendedRemediation: string;
  references: string[];
}
export interface DetailedRiskScore {
  architecture: number | null;
  accessControl: number | null;
  businessLogic: number | null;
  dependencySecurity: number | null;
  compilerSafety: number | null;
  codeQuality: number | null;
  documentation: number | null;
  overallScore: number | null;
  overallRiskRating: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL_RISK' | 'NOT_VERIFIED';
}
export interface RemediationPlan {
  id: string;
  findingsToFix: string[];
  affectedFiles: string[];
  remediationPatches: { path: string; content: string; description: string }[];
}
export interface SecurityAuditResult {
  timestamp: string;
  projectName: string;
  blockchain: string;
  findings: SecurityFinding[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  riskScore: DetailedRiskScore;
  automaticFixesApplied: string[];
  verified: boolean;
  canDeploy: boolean;
  status: 'CERTIFIED_SECURE' | 'ACTION_REQUIRED' | 'DEPLOYMENT_BLOCKED' | 'NOT_VERIFIED';
  reportMarkdown: string;
}
export class SecurityAuditEngine {
  /**
   * AI remediation is deliberately injected by the application/server layer.
   * The security engine itself never contains a hardcoded or synthetic
   * remediation fallback.
   */
  private static aiService: AIService | null = null;

  public static setAIService(service: AIService): void {
    this.aiService = service;
  }
  public static validateFinding(finding: any, files: ProjectFile[]): { valid: boolean; reason?: string } {
    if (!finding || typeof finding !== 'object') {
      return { valid: false, reason: 'Finding is null or not an object' };
    }
    const rawFile = String(finding.affectedFile || finding.file || '').trim();
    if (!rawFile) {
      return { valid: false, reason: 'Finding affectedFile is blank' };
    }
    const placeholders = ['n/a', 'undefined', 'null', 'multiple modules', 'general'];
    if (placeholders.some(p => rawFile.toLowerCase() === p)) {
      return { valid: false, reason: `Invalid finding affectedFile: '${rawFile}'` };
    }
    if (rawFile.includes('..') || rawFile.startsWith('/') || /^[a-zA-Z]:/.test(rawFile)) {
      return { valid: false, reason: `Finding file uses path traversal or absolute path: '${rawFile}'` };
    }
    const normPath = PatchEngine.normalizePath(rawFile).toLowerCase();
    if (
      normPath.startsWith('.diagnostics/') || normPath.startsWith('node_modules/') ||
      normPath.endsWith('compilation_report.md') || normPath.endsWith('security_report.md')
    ) {
      return { valid: false, reason: `Finding targets forbidden internal diagnostic file: '${rawFile}'` };
    }
    const targetFile = files.find(f => PatchEngine.normalizePath(f.path).toLowerCase() === normPath);
    if (!targetFile) {
      return { valid: false, reason: `Finding targets non-existent file in workspace: '${rawFile}'` };
    }

    // Line number validation
    let lineVal = 1;
    if (finding.lineNumbers && Array.isArray(finding.lineNumbers) && finding.lineNumbers.length > 0) {
      lineVal = Number(finding.lineNumbers[0]);
    } else {
      lineVal = Number(finding.line !== undefined ? finding.line : (finding.lineNumber !== undefined ? finding.lineNumber : 1));
    }
    if (isNaN(lineVal) || lineVal <= 0) {
      return { valid: false, reason: 'Finding contains invalid line number (must be > 0)' };
    }

    const lines = targetFile.content.split('\n');
    if (lineVal > lines.length) {
      return { valid: false, reason: `Finding line number ${lineVal} exceeds total lines of file` };
    }

    // Code snippet validation
    const snippet = String(finding.codeSnippet || finding.snippet || '').trim();
    if (!snippet || placeholders.some(p => snippet.toLowerCase() === p)) {
      return { valid: false, reason: 'Finding snippet is invalid' };
    }

    // Check if the snippet is present in the file's content
    if (!targetFile.content.includes(snippet)) {
      const lineContent = (lines[lineVal - 1] || '').trim();
      if (!lineContent || (!lineContent.includes(snippet) && !snippet.includes(lineContent))) {
        return { valid: false, reason: `Finding snippet does not match actual source code in '${rawFile}'` };
      }
    }

    return { valid: true };
  }
  public static detectBlockchain(files: ProjectFile[], inputBlockchain?: string): string {
    return DependencyValidationEngine.detectBlockchain(files, inputBlockchain);
  }
  public static loadWorkspace(files: ProjectFile[]): ProjectFile[] {
    return files.map(f => ({ ...f, path: PatchEngine.normalizePath(f.path) }));
  }
  public static performStaticAnalysis(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    let count = 1;
    const b = blockchain.toLowerCase();

    files.forEach(file => {
      const path = PatchEngine.normalizePath(file.path);
      const content = file.content;
      const lines = content.split('\n');

      if (b.includes('evm') || b.includes('ethereum')) {
        // Look for Reentrancy first
        const hasReentrancyGuard = content.includes('ReentrancyGuard') || content.includes('nonReentrant');
        lines.forEach((line, idx) => {
          if ((line.includes('.call{value:') || line.includes('.call{ value:') || line.includes('.transfer(')) && !hasReentrancyGuard) {
            findings.push({
              id: `SEC-EVM-REENTRANCY-${String(count++).padStart(3, '0')}`,
              title: 'Potential Reentrancy Vulnerability',
              blockchain,
              affectedFile: path,
              lineNumbers: [idx + 1],
              column: line.indexOf('.call') !== -1 ? line.indexOf('.call') + 1 : line.indexOf('.transfer') + 1,
              functionName: 'withdraw',
              codeSnippet: line.trim(),
              severity: 'Critical',
              confidence: 'High',
              cwe: 'SWC-107 / CWE-841',
              explanation: 'External low-level call transfers funds before state is updated.',
              impact: 'Reentrancy attack can drain all funds from contract.',
              recommendedRemediation: 'Apply checks-effects-interactions pattern or ReentrancyGuard.',
              references: ['https://swcregistry.io/docs/SWC-107']
            });
          }

          // Look for tx.origin
          if (line.includes('tx.origin') && (line.includes('==') || line.includes('require'))) {
            findings.push({
              id: `SEC-EVM-TXORIGIN-${String(count++).padStart(3, '0')}`,
              title: 'Authentication using tx.origin',
              blockchain,
              affectedFile: path,
              lineNumbers: [idx + 1],
              column: line.indexOf('tx.origin') + 1,
              functionName: 'checkOwner',
              codeSnippet: line.trim(),
              severity: 'High',
              confidence: 'High',
              cwe: 'SWC-115 / CWE-287',
              explanation: `The contract uses tx.origin for authorization at line ${idx + 1}.`,
              impact: 'Phishing attack can bypass administrative checks.',
              recommendedRemediation: 'Replace tx.origin with msg.sender.',
              references: ['https://swcregistry.io/docs/SWC-115']
            });
          }
        });
      }
    });
    return findings;
  }
  public static performArchitectureAnalysis(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const codeFiles = files.filter(f => /\.(sol|rs|move)$/i.test(f.path));
    if (blockchain === 'Ethereum/EVM' && codeFiles.length > 1 && !files.some(f => /\.(sol|rs|move)$/i.test(f.path) && /\b(interface|abstract)\b/i.test(f.content))) {
      findings.push({ id: 'ARCH-NO-ABSTRACTION', title: 'No explicit contract abstraction detected', blockchain, affectedFile: codeFiles[0]?.path || 'workspace', lineNumbers: [1], column: 1, functionName: 'N/A', codeSnippet: '', severity: 'Informational', confidence: 'Low', cwe: 'ARCH-001', explanation: 'A multi-file contract workspace contains no explicit interface or abstract contract.', impact: 'Interoperability and upgrade boundaries are less explicit.', recommendedRemediation: 'Add interfaces where external consumers or upgrade boundaries require them.', references: [] });
    }
    return findings;
  }

  public static performDependencySecurityReview(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    for (const file of files) {
      for (const match of file.content.matchAll(/import\s+(?:[^;]*?from\s+)?[\"']([^\"']+)[\"']/g)) {
        const dep = match[1];
        if (!dep.startsWith('.') && dep.toLowerCase().includes('github.com') && !dep.toLowerCase().includes('openzeppelin')) {
          findings.push({ id: `DEP-${file.path}-${dep}`, title: 'External GitHub dependency requires provenance review', blockchain, affectedFile: file.path, lineNumbers: [1], column: 1, functionName: 'N/A', codeSnippet: dep, severity: 'Low', confidence: 'Medium', cwe: 'CWE-1357', explanation: 'The dependency source is external and cannot be provenance-verified by this local rule set.', impact: 'Potential supply-chain risk.', recommendedRemediation: 'Pin and review the dependency at an immutable revision.', references: [] });
        }
      }
    }
    return findings;
  }

  public static performAccessControlReview(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    const sensitive = /\bfunction\s+\w*(?:mint|burn|withdraw|pause|upgrade|set[A-Z]\w*)\w*\s*\([^)]*\)[^{]*\{/i;
    for (const file of files.filter(f => /\.(sol|rs|move)$/i.test(f.path))) {
      file.content.split('\n').forEach((line, idx) => {
        if (sensitive.test(line) && !/(onlyOwner|onlyRole|hasRole|msg\.sender|require\s*\(|assert\s*\(|signer|authority)/i.test(line)) {
          findings.push({ id: `AC-${file.path}-${idx+1}`, title: 'Sensitive operation lacks an obvious authorization guard', blockchain, affectedFile: file.path, lineNumbers: [idx+1], column: 1, functionName: 'N/A', codeSnippet: line.trim(), severity: 'High', confidence: 'Medium', cwe: 'CWE-862', explanation: 'A sensitive operation was detected without a local-rule authorization guard.', impact: 'Unauthorized state changes may be possible.', recommendedRemediation: 'Review and enforce explicit owner/role/signer authorization.', references: [] });
        }
      });
    }
    return findings;
  }

  public static performBusinessLogicReview(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    for (const file of files.filter(f => /\.(sol|rs|move)$/i.test(f.path))) {
      file.content.split('\n').forEach((line, idx) => {
        if (/\b(TODO|FIXME|IMPLEMENTATION_REQUIRED)\b/i.test(line)) {
          findings.push({ id: `BL-${file.path}-${idx+1}`, title: 'Unresolved implementation marker', blockchain, affectedFile: file.path, lineNumbers: [idx+1], column: 1, functionName: 'N/A', codeSnippet: line.trim(), severity: 'Medium', confidence: 'High', cwe: 'CWE-546', explanation: 'The source contains an explicit unresolved implementation marker.', impact: 'Incomplete logic may reach deployment.', recommendedRemediation: 'Resolve the marker and rerun compiler/security validation.', references: [] });
        }
      });
    }
    return findings;
  }
  public static calculateRiskScore(findings: SecurityFinding[], compilerPassed?: boolean): DetailedRiskScore {
    // Only dimensions backed by an actual executed analyzer are scored.
    // Unexecuted dimensions are explicitly NOT_MEASURED rather than receiving
    // synthetic 100/50 defaults.
    let architecture: number | null = null;
    let accessControl: number | null = null;
    let businessLogic: number | null = null;
    let dependencySecurity: number | null = null;
    let compilerSafety: number | null =
      compilerPassed === true ? 100 : compilerPassed === false ? 0 : null;
    let codeQuality = 100;
    let documentation: number | null = null;

    findings.forEach(f => {
      let penalty = 0;
      switch (f.severity) {
        case 'Critical': penalty = 35; break;
        case 'High': penalty = 20; break;
        case 'Medium': penalty = 10; break;
        case 'Low': penalty = 5; break;
        case 'Informational': penalty = 1; break;
      }
      codeQuality = Math.max(0, codeQuality - penalty);
    });

    // A composite score is only meaningful when every weighted dimension has
    // authoritative evidence. Static findings alone cannot certify the missing
    // architecture/access-control/dependency/business-logic dimensions.
    const measured = [architecture, accessControl, businessLogic, dependencySecurity, compilerSafety, codeQuality, documentation];
    const overallScore = measured.every(v => typeof v === 'number')
      ? Math.round((architecture! * 0.2) + (accessControl! * 0.25) + (businessLogic! * 0.2) +
          (dependencySecurity! * 0.1) + (compilerSafety! * 0.1) + (codeQuality * 0.15))
      : null;

    return {
      architecture, accessControl, businessLogic, dependencySecurity,
      compilerSafety, codeQuality, documentation, overallScore,
      overallRiskRating: overallScore === null
        ? 'NOT_VERIFIED'
        : overallScore >= 80 ? 'LOW_RISK'
        : overallScore >= 60 ? 'MEDIUM_RISK'
        : overallScore >= 30 ? 'HIGH_RISK'
        : 'CRITICAL_RISK'
    };
  }
  public static async generateRemediationPlan(findings: SecurityFinding[], files: ProjectFile[]): Promise<RemediationPlan> {
    if (!this.aiService) {
      throw new Error('AI remediation service is not configured. SecurityAuditEngine never uses a hardcoded remediation fallback.');
    }

    const planId = `remediation-${Date.now()}`;
    const findingsToFix = findings.map(f => f.id);
    const affectedFiles = Array.from(new Set(findings.map(f => f.affectedFile)));
    const remediationPatches: { path: string; content: string; description: string }[] = [];

    for (const f of findings) {
      const file = files.find(item => PatchEngine.normalizePath(item.path).toLowerCase() === PatchEngine.normalizePath(f.affectedFile).toLowerCase());
      if (!file) continue;
      const patch = await this.aiService.generateRemediationPatch(f, file.content);
      if (!patch || typeof patch.content !== 'string' || !patch.content.trim()) {
        throw new Error(`AI remediation returned an empty patch for '${f.affectedFile}'.`);
      }
      if (patch.content !== file.content) {
        remediationPatches.push({ path: f.affectedFile, content: patch.content, description: patch.description });
      }
    }

    return { id: planId, findingsToFix, affectedFiles, remediationPatches };
  }

  public static applyAutomaticFixes(files: ProjectFile[], plan: RemediationPlan): { updatedFiles: ProjectFile[]; appliedFixes: string[] } {
    // Retained as a pure patch-overlay helper. It is NOT invoked by certifySecurity.
    const scope = PatchEngine.validatePatchScope(
      { modifiedFiles: plan.remediationPatches.map(p => ({ path: p.path, content: p.content })) },
      plan.affectedFiles,
      files
    );
    if (!scope.valid) {
      throw new Error(`Remediation patch rejected: ${scope.reason}`);
    }
    const updatedFiles = PatchEngine.applyPatch(files, {
      modifiedFiles: plan.remediationPatches.map(p => ({ path: p.path, content: p.content }))
    });
    const immutability = PatchEngine.verifyPatchImmutability(files, updatedFiles, plan.affectedFiles);
    if (!immutability.valid) {
      throw new Error(`Remediation patch immutability check failed: ${immutability.reason}`);
    }
    return {
      updatedFiles,
      appliedFixes: plan.remediationPatches.map(p => `${p.path}: ${p.description}`)
    };
  }

  public static generateSecurityReport(projectName: string, blockchain: string, findings: SecurityFinding[], score: DetailedRiskScore, fixes: string[], verified: boolean): string {
    const compilerText = score.compilerSafety === null ? 'NOT MEASURED' : `${score.compilerSafety}/100`;
    const overallText = score.overallScore === null ? 'NOT VERIFIED' : `${score.overallScore}/100`;
    return `# Security Audit Report\n**Project:** ${projectName}\n**Blockchain:** ${blockchain}\n**Compiler Safety:** ${compilerText}\n**Overall Score:** ${overallText}\n**Risk Rating:** ${score.overallRiskRating}\n**Verified:** ${verified ? 'YES' : 'NO'}\n**Findings:** ${findings.length}\n`;
  }

  /**
   * Authoritative security analysis. This method is intentionally audit-only:
   * it never mutates the workspace and never performs an implicit remediation.
   * The server remediation route owns the AI patch -> compile -> re-audit ->
   * rollback/commit transaction.
   */
  public static certifySecurity(
    files: ProjectFile[],
    projectName: string,
    inputBlockchain?: string,
    compilerEvidence?: { success: boolean; status?: string; verificationMode?: string; exitCode?: number | null }
  ): { certifiedFiles: ProjectFile[]; auditResult: SecurityAuditResult } {
    const blockchain = this.detectBlockchain(files, inputBlockchain);
    const currentWorkspace = this.loadWorkspace(files);

    const hasContracts = currentWorkspace.some(f => {
      const ext = f.path.split('.').pop()?.toLowerCase();
      return ext === 'sol' || ext === 'move' || ext === 'rs';
    });

    if (!hasContracts) {
      const score = this.calculateRiskScore([], compilerEvidence?.success);
      const reportMarkdown = this.generateSecurityReport(projectName, blockchain, [], score, [], false);
      return {
        certifiedFiles: files,
        auditResult: {
          timestamp: new Date().toISOString(), projectName, blockchain, findings: [],
          criticalCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, infoCount: 0, riskScore: score,
          automaticFixesApplied: [], verified: false, canDeploy: false,
          status: 'NOT_VERIFIED', reportMarkdown
        }
      };
    }

    const staticFindings = this.performStaticAnalysis(currentWorkspace, blockchain)
      .filter(f => this.validateFinding(f, currentWorkspace).valid);
    const completeFindings = [
      ...staticFindings,
      ...this.performArchitectureAnalysis(currentWorkspace, blockchain),
      ...this.performDependencySecurityReview(currentWorkspace, blockchain),
      ...this.performAccessControlReview(currentWorkspace, blockchain),
      ...this.performBusinessLogicReview(currentWorkspace, blockchain)
    ];

    const compilerRealPass = !!(
      compilerEvidence?.success === true && compilerEvidence?.status === 'PASS' &&
      compilerEvidence?.verificationMode === 'REAL_EXECUTION' && compilerEvidence?.exitCode === 0
    );
    const score = this.calculateRiskScore(completeFindings, compilerEvidence ? compilerRealPass : undefined);
    const hasBlockingFindings = completeFindings.some(f => f.severity === 'Critical' || f.severity === 'High');
    const verified = compilerRealPass && !hasBlockingFindings;
    const canDeploy = verified;
    const status: SecurityAuditResult['status'] = hasBlockingFindings ? 'DEPLOYMENT_BLOCKED' : (!compilerRealPass ? 'NOT_VERIFIED' : 'CERTIFIED_SECURE');

    const reportMarkdown = this.generateSecurityReport(projectName, blockchain, completeFindings, score, [], verified);

    const workingFiles = [...currentWorkspace];
    const reportFile = { path: 'SECURITY_REPORT.md', content: reportMarkdown, language: 'markdown' };
    const existingIdx = workingFiles.findIndex(f => f.path.toLowerCase() === 'security_report.md');
    if (existingIdx >= 0) workingFiles[existingIdx] = reportFile;
    else workingFiles.push(reportFile);

    return {
      certifiedFiles: workingFiles,
      auditResult: {
        timestamp: new Date().toISOString(), projectName, blockchain, findings: completeFindings,
        criticalCount: completeFindings.filter(f => f.severity === 'Critical').length,
        highCount: completeFindings.filter(f => f.severity === 'High').length,
        mediumCount: completeFindings.filter(f => f.severity === 'Medium').length,
        lowCount: completeFindings.filter(f => f.severity === 'Low').length,
        infoCount: completeFindings.filter(f => f.severity === 'Informational').length,
        riskScore: score, automaticFixesApplied: [], verified, canDeploy,
        status, reportMarkdown
      }
    };
  }
}
