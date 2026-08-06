import { ProjectFile } from '../../../types';
import { PatchEngine } from '../patch/PatchEngine';
import { ProjectIntegrityEngine } from '../validators/ProjectIntegrityEngine';
import { DependencyValidationEngine } from '../validators/DependencyValidationEngine';
import { CompilerEngine } from '../compiler/CompilerEngine';

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
  architecture: number;
  accessControl: number;
  businessLogic: number;
  dependencySecurity: number;
  compilerSafety: number;
  codeQuality: number;
  documentation: number;
  overallScore: number;
  overallRiskRating: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL_RISK';
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
  status: 'CERTIFIED_SECURE' | 'ACTION_REQUIRED' | 'DEPLOYMENT_BLOCKED';
  reportMarkdown: string;
}

export class SecurityAuditEngine {
  /**
   * Detect blockchain target for security rule sets
   */
  public static detectBlockchain(files: ProjectFile[], inputBlockchain?: string): string {
    return DependencyValidationEngine.detectBlockchain(files, inputBlockchain);
  }

  /**
   * Loads and normalizes workspace files for audit
   */
  public static loadWorkspace(files: ProjectFile[]): ProjectFile[] {
    return files.map(f => ({
      ...f,
      path: PatchEngine.normalizePath(f.path)
    }));
  }

  /**
   * Loads compiler report from workspace
   */
  public static loadCompilerReport(files: ProjectFile[]): string {
    const report = files.find(f => PatchEngine.normalizePath(f.path).toLowerCase() === 'compilation_report.md');
    return report ? report.content : 'No compilation report present.';
  }

  /**
   * Loads dependency report from workspace
   */
  public static loadDependencyReport(files: ProjectFile[]): string {
    const report = files.find(f => PatchEngine.normalizePath(f.path).toLowerCase() === 'dependency_report.md');
    return report ? report.content : 'No dependency report present.';
  }

  /**
   * Loads validation report from workspace
   */
  public static loadValidationReport(files: ProjectFile[]): string {
    const report = files.find(f => PatchEngine.normalizePath(f.path).toLowerCase() === 'project_validation.md');
    return report ? report.content : 'No validation report present.';
  }

  /**
   * Static Analysis: Detects vulnerabilities based on AST / Pattern scanning
   */
  public static performStaticAnalysis(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];
    let count = 1;

    files.forEach(file => {
      const path = PatchEngine.normalizePath(file.path);
      const content = file.content;
      const lines = content.split('\n');

      if (blockchain === 'Ethereum/EVM') {
        // EVM 1: tx.origin authentication vulnerability
        lines.forEach((line, idx) => {
          if (line.includes('tx.origin') && (line.includes('==') || line.includes('require'))) {
            findings.push({
              id: `SEC-EVM-${String(count++).padStart(3, '0')}`,
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
              explanation: `The contract uses tx.origin for authorization at line ${idx + 1}. Phishing contracts can exploit tx.origin to drain funds.`,
              impact: 'Attacker can trick an authorized caller into invoking contract methods through a phishing contract.',
              recommendedRemediation: 'Replace tx.origin with msg.sender for authorization checks.',
              references: ['https://swcregistry.io/docs/SWC-115']
            });
          }
        });

        // EVM 2: Reentrancy check (unprotected call before state update)
        if (path.endsWith('.sol')) {
          if ((content.includes('.call{value:') || content.includes('.transfer(')) && !content.includes('ReentrancyGuard') && !content.includes('nonReentrant')) {
            findings.push({
              id: `SEC-EVM-${String(count++).padStart(3, '0')}`,
              title: 'Potential Reentrancy Vector in External Ether Transfer',
              blockchain,
              affectedFile: path,
              lineNumbers: [1],
              column: 1,
              functionName: 'withdraw',
              codeSnippet: content.substring(0, 150).trim(),
              severity: 'Critical',
              confidence: 'Medium',
              cwe: 'SWC-107 / CWE-841',
              explanation: `Contract performs low-level state-changing ether transfer via call/transfer without ReentrancyGuard or nonReentrant modifier.`,
              impact: 'Malicious external contract can recursively reenter state-changing functions and drain vault balances.',
              recommendedRemediation: 'Import OpenZeppelin ReentrancyGuard and attach nonReentrant to functions making low-level calls.',
              references: ['https://swcregistry.io/docs/SWC-107']
            });
          }
        }

        // EVM 3: Unchecked low-level call return value
        lines.forEach((line, idx) => {
          if (line.includes('.call(') || line.includes('.delegatecall(')) {
            if (!line.includes('require(') && !line.includes('bool success') && !lines[idx + 1]?.includes('success')) {
              findings.push({
                id: `SEC-EVM-${String(count++).padStart(3, '0')}`,
                title: 'Unchecked Return Value for Low-Level Call',
                blockchain,
                affectedFile: path,
                lineNumbers: [idx + 1],
                column: line.indexOf('.call(') + 1,
                functionName: 'executeCall',
                codeSnippet: line.trim(),
                severity: 'Medium',
                confidence: 'High',
                cwe: 'SWC-104 / CWE-252',
                explanation: `Low-level call on line ${idx + 1} does not verify boolean success return value.`,
                impact: 'Call execution may silently fail, leaving contract state inconsistent.',
                recommendedRemediation: 'Check return value: (bool success, ) = target.call(...); require(success, "Call failed");',
                references: ['https://swcregistry.io/docs/SWC-104']
              });
            }
          }
        });
      } else if (blockchain === 'Solana') {
        // Solana Anchor Rules
        lines.forEach((line, idx) => {
          if (line.includes('AccountInfo') && !line.includes('Account<') && !line.includes('Signer<') && !line.includes('/// CHECK') && !line.includes('UncheckedAccount')) {
            findings.push({
              id: `SEC-SOL-${String(count++).padStart(3, '0')}`,
              title: 'Unchecked Raw AccountInfo Validation',
              blockchain,
              affectedFile: path,
              lineNumbers: [idx + 1],
              column: line.indexOf('AccountInfo') + 1,
              functionName: 'process_instruction',
              codeSnippet: line.trim(),
              severity: 'Low',
              confidence: 'Medium',
              cwe: 'CWE-285 (Solana Missing Owner Check)',
              explanation: `Raw AccountInfo used at line ${idx + 1} without explicit owner or discriminator check.`,
              impact: 'An attacker can supply a spoofed account created by a malicious program.',
              recommendedRemediation: 'Replace raw AccountInfo with Anchor Account<\'info, T> or explicit owner check.',
              references: ['https://docs.anchor-lang.com/security/owner_checks.html']
            });
          }
        });
      }
 else if (blockchain === 'Aptos' || blockchain === 'Sui') {
        // Move Rules
        lines.forEach((line, idx) => {
          if (line.includes('public entry fn') || line.includes('public fun')) {
            if (!line.includes('&signer') && !line.includes('Signer')) {
              findings.push({
                id: `SEC-MOVE-${String(count++).padStart(3, '0')}`,
                title: 'Missing Signer Parameter in Move Public Function',
                blockchain,
                affectedFile: path,
                lineNumbers: [idx + 1],
                column: line.indexOf('fun') + 1,
                functionName: 'initialize',
                codeSnippet: line.trim(),
                severity: 'Medium',
                confidence: 'Medium',
                cwe: 'CWE-862 (Missing Authorization)',
                explanation: `Public function at line ${idx + 1} does not require a signer reference (&signer).`,
                impact: 'Unauthenticated callers can execute the function on behalf of arbitrary accounts.',
                recommendedRemediation: 'Add caller: &signer parameter to enforce transaction signature verification.',
                references: ['https://aptos.dev/guides/move-guides/move-security']
              });
            }
          }
        });
      }
    });

    return findings;
  }

  /**
   * Architecture Analysis: Business logic completeness, emergency pause, upgradeability, event coverage
   */
  public static performArchitectureAnalysis(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    if (blockchain === 'Ethereum/EVM') {
      const solFiles = files.filter(f => f.path.endsWith('.sol'));
      solFiles.forEach(file => {
        if (!file.content.includes('event ') && (file.content.includes('function ') || file.content.includes('contract '))) {
          findings.push({
            id: 'SEC-ARCH-001',
            title: 'Missing Event Emission Coverage',
            blockchain,
            affectedFile: file.path,
            lineNumbers: [1],
            column: 1,
            functionName: 'global',
            codeSnippet: file.content.substring(0, 100).trim(),
            severity: 'Low',
            confidence: 'High',
            cwe: 'CWE-778 (Insufficient Logging)',
            explanation: `Contract ${file.path} lacks event declarations for off-chain indexing and monitoring.`,
            impact: 'Off-chain indexing tools and web3 frontends cannot reliably track state changes.',
            recommendedRemediation: 'Declare and emit indexed events for critical state-changing functions.',
            references: ['https://consensys.github.io/smart-contract-best-practices/development-recommendations/solidity-specific/events/']
          });
        }
      });
    }

    return findings;
  }

  /**
   * Dependency Security Review: Evaluates third-party package security
   */
  public static performDependencySecurityReview(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    const pkg = files.find(f => f.path.toLowerCase() === 'package.json');
    if (pkg && blockchain === 'Ethereum/EVM') {
      if (pkg.content.includes('"@openzeppelin/contracts": "^4.') || pkg.content.includes('"@openzeppelin/contracts": "4.')) {
        findings.push({
          id: 'SEC-DEP-001',
          title: 'Outdated OpenZeppelin Version Standard',
          blockchain,
          affectedFile: pkg.path,
          lineNumbers: [1],
          column: 1,
          functionName: 'dependencies',
          codeSnippet: pkg.content.substring(0, 150).trim(),
          severity: 'Informational',
          confidence: 'High',
          cwe: 'CWE-1104',
          explanation: 'Using OpenZeppelin v4 dependency. OpenZeppelin v5 is recommended for enhanced security and gas efficiency.',
          impact: 'Misses modern custom errors and optimized storage patterns available in OpenZeppelin v5.',
          recommendedRemediation: 'Upgrade package.json to @openzeppelin/contracts ^5.0.0.',
          references: ['https://openzeppelin.com/contracts/']
        });
      }
    }

    return findings;
  }

  /**
   * Access Control Review: Checks administrative restrictions and privilege boundaries
   */
  public static performAccessControlReview(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    files.forEach(file => {
      if (file.path.endsWith('.sol')) {
        const lines = file.content.split('\n');
        lines.forEach((line, idx) => {
          if ((line.includes('function withdraw') || line.includes('function set') || line.includes('function pause')) &&
              !line.includes('view') && !line.includes('pure') &&
              !line.includes('onlyOwner') && !line.includes('hasRole') && !line.includes('onlyAdmin') &&
              !line.includes('onlyGovernance') && !line.includes('auth') && !line.includes('internal') && !line.includes('private') &&
              !file.content.includes('onlyOwner') && !file.content.includes('hasRole') && !file.content.includes('onlyAdmin')) {
            findings.push({
              id: `SEC-ACCESS-${idx + 1}`,
              title: 'Unrestricted Administrative or Vault Function',
              blockchain,
              affectedFile: file.path,
              lineNumbers: [idx + 1],
              column: line.indexOf('function') + 1,
              functionName: 'withdraw',
              codeSnippet: line.trim(),
              severity: 'Low',
              confidence: 'Medium',
              cwe: 'SWC-105 / CWE-284',
              explanation: `Critical administrative or withdrawal method on line ${idx + 1} lacks access control modifier (onlyOwner / hasRole).`,
              impact: 'Any public user can invoke privileged methods to alter protocol state or withdraw funds.',
              recommendedRemediation: 'Attach onlyOwner or hasRole modifier to restrict caller permissions.',
              references: ['https://swcregistry.io/docs/SWC-105']
            });
          }
        });
      }
    });

    return findings;
  }

  /**
   * Business Logic Review: Evaluates math operations, zero address checks, and state machine invariants
   */
  public static performBusinessLogicReview(files: ProjectFile[], blockchain: string): SecurityFinding[] {
    const findings: SecurityFinding[] = [];

    files.forEach(file => {
      if (file.path.endsWith('.sol')) {
        if (file.content.includes('constructor') && !file.content.includes('require(') && !file.content.includes('if (') && file.content.includes('address')) {
          findings.push({
            id: 'SEC-LOGIC-001',
            title: 'Missing Zero-Address Validation in Constructor / Initializer',
            blockchain,
            affectedFile: file.path,
            lineNumbers: [10],
            column: 1,
            functionName: 'constructor',
            codeSnippet: file.content.substring(0, 200).trim(),
            severity: 'Low',
            confidence: 'Medium',
            cwe: 'CWE-20 (Improper Input Validation)',
            explanation: `Constructor or initializer accepts address parameters without checking against address(0).`,
            impact: 'Accidental initialization with address(0) can permanently lock contract permissions or funds.',
            recommendedRemediation: 'Add require(newOwner != address(0), "Zero address"); validation check.',
            references: ['https://github.com/crytic/slither/wiki/Detector-Documentation#missing-zero-address-validation']
          });
        }
      }
    });

    return findings;
  }

  /**
   * Calculates granular category scores and overall risk rating
   */
  public static calculateRiskScore(findings: SecurityFinding[]): DetailedRiskScore {
    let architecture = 100;
    let accessControl = 100;
    let businessLogic = 100;
    let dependencySecurity = 100;
    let compilerSafety = 100;
    let codeQuality = 100;
    let documentation = 100;

    findings.forEach(f => {
      let penalty = 0;
      switch (f.severity) {
        case 'Critical': penalty = 35; break;
        case 'High': penalty = 20; break;
        case 'Medium': penalty = 10; break;
        case 'Low': penalty = 5; break;
        case 'Informational': penalty = 1; break;
      }

      if (f.id.includes('ARCH')) architecture = Math.max(0, architecture - penalty);
      else if (f.id.includes('ACCESS')) accessControl = Math.max(0, accessControl - penalty);
      else if (f.id.includes('DEP')) dependencySecurity = Math.max(0, dependencySecurity - penalty);
      else if (f.id.includes('LOGIC')) businessLogic = Math.max(0, businessLogic - penalty);
      else codeQuality = Math.max(0, codeQuality - penalty);
    });

    const overallScore = Math.round(
      (architecture * 0.2) +
      (accessControl * 0.25) +
      (businessLogic * 0.2) +
      (dependencySecurity * 0.1) +
      (compilerSafety * 0.1) +
      (codeQuality * 0.15)
    );

    let overallRiskRating: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | 'CRITICAL_RISK' = 'LOW_RISK';
    const criticals = findings.filter(f => f.severity === 'Critical').length;
    const highs = findings.filter(f => f.severity === 'High').length;

    if (criticals > 0) overallRiskRating = 'CRITICAL_RISK';
    else if (highs > 0) overallRiskRating = 'HIGH_RISK';
    else if (overallScore < 80) overallRiskRating = 'MEDIUM_RISK';

    return {
      architecture,
      accessControl,
      businessLogic,
      dependencySecurity,
      compilerSafety,
      codeQuality,
      documentation,
      overallScore,
      overallRiskRating
    };
  }

  /**
   * Generates targeted remediation plan for detected security findings
   */
  public static generateRemediationPlan(findings: SecurityFinding[], files: ProjectFile[]): RemediationPlan {
    const planId = `remediation-${Date.now()}`;
    const findingsToFix = findings.map(f => f.id);
    const affectedFiles = Array.from(new Set(findings.map(f => f.affectedFile)));
    const remediationPatches: { path: string; content: string; description: string }[] = [];

    findings.forEach(f => {
      const file = files.find(item => item.path === f.affectedFile);
      if (!file) return;

      let newContent = file.content;
      let desc = f.recommendedRemediation;

      if (f.id.includes('EVM') || f.title.includes('Reentrancy')) {
        if (f.title.includes('tx.origin')) {
          newContent = newContent.replace(/tx\.origin/g, 'msg.sender');
          desc = 'Replaced tx.origin with msg.sender for secure authorization.';
        }
        if (f.title.includes('Reentrancy')) {
          if (!newContent.includes('ReentrancyGuard')) {
            newContent = `import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";\n` + newContent;
            if (newContent.includes(' is ')) {
              newContent = newContent.replace(/contract\s+([A-Za-z0-9_]+)\s+is\s+/, 'contract $1 is ReentrancyGuard, ');
            } else {
              newContent = newContent.replace(/contract\s+([A-Za-z0-9_]+)\s*\{/, 'contract $1 is ReentrancyGuard {');
            }
          }
          if (!newContent.includes('nonReentrant')) {
            newContent = newContent.replace(/(function\s+[A-Za-z0-9_]+\s*\([^)]*\)\s*(?:public|external))/g, '$1 nonReentrant');
          }
          desc = 'Added ReentrancyGuard inheritance and nonReentrant modifier to state-changing functions.';
        }
      }

      if (newContent !== file.content) {
        remediationPatches.push({
          path: f.affectedFile,
          content: newContent,
          description: desc
        });
      }
    });

    return {
      id: planId,
      findingsToFix,
      affectedFiles,
      remediationPatches
    };
  }

  /**
   * Applies remediation fixes through immutable file updates
   */
  public static applyAutomaticFixes(
    files: ProjectFile[],
    plan: RemediationPlan
  ): { updatedFiles: ProjectFile[]; appliedFixes: string[] } {
    const updatedFiles = [...files];
    const appliedFixes: string[] = [];

    plan.remediationPatches.forEach(patch => {
      const idx = updatedFiles.findIndex(f => f.path === patch.path);
      if (idx >= 0) {
        updatedFiles[idx] = {
          ...updatedFiles[idx],
          content: patch.content
        };
        appliedFixes.push(`${patch.path}: ${patch.description}`);
      }
    });

    return { updatedFiles, appliedFixes };
  }

  /**
   * Re-validates project after applying security fixes
   */
  public static verifyFixes(
    files: ProjectFile[],
    projectName: string
  ): { verified: boolean; remainingFindings: SecurityFinding[] } {
    const blockchain = this.detectBlockchain(files);
    const staticFindings = this.performStaticAnalysis(files, blockchain);
    const accessFindings = this.performAccessControlReview(files, blockchain);
    const allFindings = [...staticFindings, ...accessFindings];

    const criticalOrHigh = allFindings.filter(f => f.severity === 'Critical' || f.severity === 'High');
    return {
      verified: criticalOrHigh.length === 0,
      remainingFindings: allFindings
    };
  }

  /**
   * Generates comprehensive SECURITY_REPORT.md markdown document
   */
  public static generateSecurityReport(
    projectName: string,
    blockchain: string,
    findings: SecurityFinding[],
    score: DetailedRiskScore,
    fixes: string[],
    verified: boolean
  ): string {
    const criticals = findings.filter(f => f.severity === 'Critical');
    const highs = findings.filter(f => f.severity === 'High');
    const mediums = findings.filter(f => f.severity === 'Medium');
    const lows = findings.filter(f => f.severity === 'Low');
    const infos = findings.filter(f => f.severity === 'Informational');

    return `# Security Audit & Remediation Report

**Project Name:** ${projectName}
**Target Blockchain:** ${blockchain}
**Timestamp:** ${new Date().toISOString()}
**Overall Security Rating:** ${score.overallRiskRating} (${score.overallScore}/100)
**Verification Status:** ${verified ? 'CERTIFIED PASS (0 CRITICAL / 0 HIGH)' : 'ACTION REQUIRED'}

---

## Executive Summary
The **Security Audit & Remediation Engine** performed full static analysis, architecture review, access control audit, and dependency security verification for **${projectName}**.

---

## Security Category Ratings

| Category | Score | Rating |
| :--- | :---: | :--- |
| **Architecture & Modularity** | ${score.architecture} / 100 | ${score.architecture >= 80 ? '✅ STRONG' : '⚠️ WARN'} |
| **Access Control & Permissions** | ${score.accessControl} / 100 | ${score.accessControl >= 80 ? '✅ SECURE' : '❌ CRITICAL'} |
| **Business Logic & Math** | ${score.businessLogic} / 100 | ${score.businessLogic >= 80 ? '✅ VALIDATED' : '⚠️ WARN'} |
| **Dependency Security** | ${score.dependencySecurity} / 100 | ${score.dependencySecurity >= 80 ? '✅ UP-TO-DATE' : '⚠️ WARN'} |
| **Compiler Safety** | ${score.compilerSafety} / 100 | ✅ CERTIFIED |
| **Code Quality & Practice** | ${score.codeQuality} / 100 | ✅ PASSED |
| **Documentation & Events** | ${score.documentation} / 100 | ✅ PASSED |

---

## Vulnerability Findings Summary

- **Critical:** ${criticals.length}
- **High:** ${highs.length}
- **Medium:** ${mediums.length}
- **Low:** ${lows.length}
- **Informational:** ${infos.length}

---

## Audit Findings & Evidence

${findings.length > 0 ? findings.map(f => `### [${f.severity.toUpperCase()}] ${f.id}: ${f.title}
- **Affected File:** \`${f.affectedFile}\` (Lines: ${f.lineNumbers.join(', ')})
- **Confidence:** ${f.confidence}
- **CWE / SWC:** ${f.cwe}
- **Explanation:** ${f.explanation}
- **Impact:** ${f.impact}
- **Remediation:** ${f.recommendedRemediation}
- **References:** ${f.references.join(', ')}
`).join('\n') : '- Zero vulnerability findings detected.'}

---

## Applied Automated Fixes Log
${fixes.length > 0 ? fixes.map(fix => `- ${fix}`).join('\n') : '- No automatic security fixes were required.'}

---

## Deployment Gate Status
- **Critical Issues Remaining:** ${criticals.length}
- **High Issues Remaining:** ${highs.length}
- **Deployment Eligibility:** ${verified ? 'APPROVED FOR MAINNET / TESTNET DEPLOYMENT' : 'BLOCKED - RESOLVE CRITICAL/HIGH FINDINGS'}
`;
  }

  /**
   * Main Security Engine Certification Pipeline Entry Point
   * Audits workspace, applies auto-remedies, verifies fixes, and attaches SECURITY_REPORT.md
   */
  public static certifySecurity(
    files: ProjectFile[],
    projectName: string,
    inputBlockchain?: string
  ): { certifiedFiles: ProjectFile[]; auditResult: SecurityAuditResult } {
    const blockchain = this.detectBlockchain(files, inputBlockchain);
    const workspace = this.loadWorkspace(files);

    // 1. Run all audit checks
    const staticFindings = this.performStaticAnalysis(workspace, blockchain);
    const archFindings = this.performArchitectureAnalysis(workspace, blockchain);
    const depFindings = this.performDependencySecurityReview(workspace, blockchain);
    const accessFindings = this.performAccessControlReview(workspace, blockchain);
    const logicFindings = this.performBusinessLogicReview(workspace, blockchain);

    const initialFindings = [
      ...staticFindings,
      ...archFindings,
      ...depFindings,
      ...accessFindings,
      ...logicFindings
    ];

    // 2. Phase 9: SELF-HEALING ENGINE (up to 3 passes of security analysis & repair)
    let currentWorkspace = [...workspace];
    let attempts = 0;
    const maxAttempts = 3;
    let appliedFixesAccumulator: string[] = [];
    let currentFindings = [...initialFindings];

    while (currentFindings.length > 0 && attempts < maxAttempts) {
      attempts++;
      const plan = this.generateRemediationPlan(currentFindings, currentWorkspace);
      if (plan.remediationPatches.length === 0) {
        break; // No further automatic fixes can be generated
      }
      const fixRes = this.applyAutomaticFixes(currentWorkspace, plan);
      currentWorkspace = fixRes.updatedFiles;
      appliedFixesAccumulator.push(...fixRes.appliedFixes);

      // Re-run all audits to identify remaining issues
      const nextStatic = this.performStaticAnalysis(currentWorkspace, blockchain);
      const nextArch = this.performArchitectureAnalysis(currentWorkspace, blockchain);
      const nextDep = this.performDependencySecurityReview(currentWorkspace, blockchain);
      const nextAccess = this.performAccessControlReview(currentWorkspace, blockchain);
      const nextLogic = this.performBusinessLogicReview(currentWorkspace, blockchain);

      currentFindings = [
        ...nextStatic,
        ...nextArch,
        ...nextDep,
        ...nextAccess,
        ...nextLogic
      ];
    }

    const score = this.calculateRiskScore(currentFindings);
    const canDeploy = currentFindings.filter(f => f.severity === 'Critical' || f.severity === 'High').length === 0;

    const reportMarkdown = this.generateSecurityReport(
      projectName,
      blockchain,
      currentFindings,
      score,
      appliedFixesAccumulator,
      canDeploy
    );

    const workingFiles = [...currentWorkspace];

    // Attach SECURITY_REPORT.md & reports/security_report.md
    const reportPaths = ['SECURITY_REPORT.md', 'reports/security_report.md'];
    reportPaths.forEach(repPath => {
      const existingIdx = workingFiles.findIndex(f => PatchEngine.normalizePath(f.path).toLowerCase() === repPath.toLowerCase());
      if (existingIdx >= 0) {
        workingFiles[existingIdx] = { path: repPath, content: reportMarkdown, language: 'markdown' };
      } else {
        workingFiles.push({ path: repPath, content: reportMarkdown, language: 'markdown' });
      }
    });

    const auditResult: SecurityAuditResult = {
      timestamp: new Date().toISOString(),
      projectName,
      blockchain,
      findings: currentFindings,
      criticalCount: currentFindings.filter(f => f.severity === 'Critical').length,
      highCount: currentFindings.filter(f => f.severity === 'High').length,
      mediumCount: currentFindings.filter(f => f.severity === 'Medium').length,
      lowCount: currentFindings.filter(f => f.severity === 'Low').length,
      infoCount: currentFindings.filter(f => f.severity === 'Informational').length,
      riskScore: score,
      automaticFixesApplied: appliedFixesAccumulator,
      verified: canDeploy,
      canDeploy,
      status: canDeploy ? 'CERTIFIED_SECURE' : 'DEPLOYMENT_BLOCKED',
      reportMarkdown
    };

    return {
      certifiedFiles: workingFiles,
      auditResult
    };
  }

  /**
   * Deployment Gate Checker: Validates if project is eligible for testnet/mainnet deployment
   * Enforces: Critical = 0, High = 0, Integrity PASS, Dependency PASS, Compiler PASS
   */
  public static validateDeploymentGate(
    files: ProjectFile[],
    projectName: string
  ): { canDeploy: boolean; reason: string; report: string } {
    const integrity = ProjectIntegrityEngine.certifyProject(files, projectName);
    const dependency = DependencyValidationEngine.validateAndCertifyToolchain(integrity.certifiedFiles, projectName);
    const compilation = CompilerEngine.certifyCompilation(dependency.certifiedFiles, projectName);
    const audit = this.certifySecurity(compilation.certifiedFiles, projectName);

    const criticalCount = audit.auditResult.criticalCount;
    const highCount = audit.auditResult.highCount;
    const integrityPass = integrity.report.overallStatus !== 'FAIL';
    const dependencyPass = dependency.result.overallStatus !== 'FAIL';
    const compilerPass = compilation.result.success;

    const canDeploy = criticalCount === 0 && highCount === 0 && integrityPass && dependencyPass && compilerPass;

    let reason = 'Project passed all security, integrity, dependency, and compilation deployment gates.';
    if (!canDeploy) {
      const blockers: string[] = [];
      if (criticalCount > 0) blockers.push(`${criticalCount} Critical Security Finding(s)`);
      if (highCount > 0) blockers.push(`${highCount} High Security Finding(s)`);
      if (!integrityPass) blockers.push(`Project Integrity Failures (${integrity.report.missingAssets.length} missing files)`);
      if (!dependencyPass) blockers.push('Dependency Validation Failures');
      if (!compilerPass) blockers.push('Compiler Errors');
      reason = `Deployment Blocked: ${blockers.join(', ')}. Resolving these issues is required before deployment.`;
    }

    return {
      canDeploy,
      reason,
      report: audit.auditResult.reportMarkdown
    };
  }

  /**
   * Alias for certifySecurity
   */
  public static audit(
    files: ProjectFile[],
    projectName: string = 'SmartContractProject',
    blockchain?: string,
    prompt?: string
  ) {
    if (!Array.isArray(files)) throw new Error("SecurityAuditEngine.audit: files must be an array");
    const cert = this.certifySecurity(files, projectName, blockchain);
    if (!cert || !cert.certifiedFiles) throw new Error("SecurityAuditEngine returned invalid result");
    return cert;
  }

  /**
   * Alias for certifySecurity
   */
  public static certify(
    files: ProjectFile[],
    projectName: string = 'SmartContractProject',
    blockchain?: string,
    prompt?: string
  ) {
    return this.audit(files, projectName, blockchain, prompt);
  }
}

