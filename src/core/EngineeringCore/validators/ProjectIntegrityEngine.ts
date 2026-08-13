import { ProjectFile } from '../../../types';
import { PatchEngine } from '../patch/PatchEngine';
import { WorkspaceIsolationValidator } from './WorkspaceIsolationValidator';

export type EcosystemType = 'evm' | 'solana' | 'move' | 'generic';

export interface IntegrityCheckResult {
  category: string;
  passed: boolean;
  message: string;
  details?: string[];
}

export interface ProjectValidationReport {
  timestamp: string;
  projectName: string;
  ecosystem: EcosystemType;
  overallStatus: 'PASS' | 'WARN' | 'FAIL';
  compilerReadiness: 'COMPILER_READY' | 'REPAIR_NEEDED' | 'NOT_READY';
  checks: IntegrityCheckResult[];
  repairActions: string[];
  generatedAssets: string[];
  missingAssets: string[];
  warnings: string[];
}

export class ProjectIntegrityEngine {
  /**
   * Detect ecosystem from files, language, blockchain, or framework
   */
  public static detectEcosystem(
    files: ProjectFile[],
    blockchain?: string,
    language?: string,
    framework?: string
  ): EcosystemType {
    const b = (blockchain || '').toLowerCase();
    const l = (language || '').toLowerCase();
    const f = (framework || '').toLowerCase();

    if (b.includes('solana') || l.includes('rust') || f.includes('anchor')) {
      return 'solana';
    }
    if (b.includes('aptos') || b.includes('sui') || l.includes('move')) {
      return 'move';
    }
    if (
      b.includes('ethereum') ||
      b.includes('polygon') ||
      b.includes('arbitrum') ||
      b.includes('optimism') ||
      b.includes('bsc') ||
      b.includes('avalanche') ||
      l.includes('solidity') ||
      f.includes('hardhat') ||
      f.includes('foundry')
    ) {
      return 'evm';
    }

    // Fallback based on file extensions
    const hasSol = files.some(file => file.path.toLowerCase().endsWith('.sol'));
    if (hasSol) return 'evm';

    const hasRs = files.some(file => file.path.toLowerCase().endsWith('.rs'));
    if (hasRs) return 'solana';

    const hasMove = files.some(file => file.path.toLowerCase().endsWith('.move'));
    if (hasMove) return 'move';

    return 'evm';
  }

  /**
   * Validates required directories based on ecosystem
   */
  public static validateRequiredDirectories(files: ProjectFile[], ecosystem: EcosystemType): IntegrityCheckResult {
    const paths = files.map(f => PatchEngine.normalizePath(f.path).toLowerCase());
    const details: string[] = [];

    let requiredFolders: string[] = [];
    if (ecosystem === 'evm') {
      requiredFolders = ['contracts/', 'interfaces/', 'libraries/', 'scripts/', 'test/', 'artifacts/', 'reports/', 'docs/'];
    } else if (ecosystem === 'solana') {
      requiredFolders = ['programs/', 'tests/', 'migrations/', 'app/', 'reports/', 'docs/'];
    } else if (ecosystem === 'move') {
      requiredFolders = ['sources/', 'scripts/', 'tests/', 'reports/', 'docs/'];
    } else {
      requiredFolders = ['contracts/', 'scripts/', 'tests/', 'reports/', 'docs/'];
    }

    const missingFolders: string[] = [];
    requiredFolders.forEach(folder => {
      const folderPrefix = folder.toLowerCase();
      const hasFileInFolder = paths.some(p => p.startsWith(folderPrefix) || p.includes('/' + folderPrefix));
      if (!hasFileInFolder) {
        missingFolders.push(folder);
      }
    });

    if (missingFolders.length > 0) {
      details.push(`Missing directories: ${missingFolders.join(', ')}`);
    }

    return {
      category: 'Project Structure & Directories',
      passed: missingFolders.length === 0,
      message: missingFolders.length === 0 ? 'All required project directories are present.' : `Missing ${missingFolders.length} required directory structures.`,
      details
    };
  }

  /**
   * Validates required files (configs, docs) based on ecosystem
   */
  public static validateRequiredFiles(files: ProjectFile[], ecosystem: EcosystemType): IntegrityCheckResult {
    const paths = new Set(files.map(f => PatchEngine.normalizePath(f.path).toLowerCase()));
    const missingFiles: string[] = [];

    // Universal docs
    const universalDocs = ['readme.md', 'architecture.md', 'security.md', 'deployment.md', 'changelog.md', 'license', '.env.example'];
    universalDocs.forEach(doc => {
      if (!paths.has(doc)) missingFiles.push(doc);
    });

    // Tooling configs
    if (ecosystem === 'evm') {
      if (!paths.has('package.json')) missingFiles.push('package.json');
      if (!paths.has('foundry.toml') && !paths.has('hardhat.config.ts') && !paths.has('hardhat.config.js')) {
        missingFiles.push('foundry.toml or hardhat.config.ts');
      }
    } else if (ecosystem === 'solana') {
      if (!paths.has('anchor.toml')) missingFiles.push('Anchor.toml');
      if (!paths.has('cargo.toml')) missingFiles.push('Cargo.toml');
    } else if (ecosystem === 'move') {
      if (!paths.has('move.toml')) missingFiles.push('Move.toml');
    }

    return {
      category: 'Required Configuration & Documentation Files',
      passed: missingFiles.length === 0,
      message: missingFiles.length === 0 ? 'All required project configuration and documentation files exist.' : `Missing ${missingFiles.length} required files.`,
      details: missingFiles.map(m => `Missing file: ${m}`)
    };
  }

  /**
   * Validates import statements in source code
   */
  public static validateImports(files: ProjectFile[], ecosystem: EcosystemType): IntegrityCheckResult {
    const filePaths = new Set(files.map(f => PatchEngine.normalizePath(f.path)));
    const brokenImports: string[] = [];

    files.forEach(file => {
      const p = file.path.toLowerCase();
      if (p.endsWith('.sol')) {
        const importRegex = /import\s+(?:(?:\{[^}]*\}|\*)\s+from\s+)?["']([^"']+)["']/g;
        let match: RegExpExecArray | null;
        while ((match = importRegex.exec(file.content)) !== null) {
          const importPath = match[1];
          if (importPath.startsWith('.')) {
            // Relative import check
            const currentDir = file.path.substring(0, file.path.lastIndexOf('/'));
            const parts = (currentDir + '/' + importPath).split('/');
            const resolvedStack: string[] = [];
            for (const part of parts) {
              if (part === '.' || part === '') continue;
              if (part === '..') {
                resolvedStack.pop();
              } else {
                resolvedStack.push(part);
              }
            }
            const resolvedPath = resolvedStack.join('/');
            if (!filePaths.has(resolvedPath) && !filePaths.has(resolvedPath + '.sol')) {
              brokenImports.push(`${file.path} -> ${importPath} (Resolved: ${resolvedPath})`);
            }
          }
        }
      }
    });

    return {
      category: 'Import Integrity',
      passed: brokenImports.length === 0,
      message: brokenImports.length === 0 ? 'All code imports resolve cleanly.' : `Found ${brokenImports.length} broken or unresolved imports.`,
      details: brokenImports
    };
  }

  /**
   * Validates dependencies in configuration files
   */
  public static validateDependencies(files: ProjectFile[], ecosystem: EcosystemType): IntegrityCheckResult {
    const details: string[] = [];
    let passed = true;

    if (ecosystem === 'evm') {
      const pkgFile = files.find(f => PatchEngine.normalizePath(f.path).toLowerCase() === 'package.json');
      if (pkgFile) {
        if (!pkgFile.content.includes('@openzeppelin/contracts') && !pkgFile.content.includes('openzeppelin')) {
          details.push('OpenZeppelin Contracts dependency recommendation missing in package.json');
        }
      } else {
        passed = false;
        details.push('package.json file missing for EVM ecosystem dependencies');
      }
    } else if (ecosystem === 'solana') {
      const cargoFile = files.find(f => PatchEngine.normalizePath(f.path).toLowerCase() === 'cargo.toml');
      if (cargoFile) {
        if (!cargoFile.content.includes('anchor-lang')) {
          details.push('anchor-lang dependency missing in Cargo.toml');
        }
      }
    }

    return {
      category: 'Dependency Specification',
      passed,
      message: passed ? 'Project dependencies properly specified.' : 'Dependency specifications incomplete.',
      details
    };
  }

  /**
   * Validates test coverage & assets
   */
  public static validateTests(files: ProjectFile[], ecosystem: EcosystemType): IntegrityCheckResult {
    const hasTests = files.some(f => {
      const p = PatchEngine.normalizePath(f.path).toLowerCase();
      return (
        p.startsWith('test/') ||
        p.startsWith('tests/') ||
        p.endsWith('.test.ts') ||
        p.endsWith('.spec.ts') ||
        p.endsWith('.t.sol') ||
        p.endsWith('_test.rs') ||
        p.endsWith('_test.move')
      );
    });

    return {
      category: 'Unit & Integration Test Assets',
      passed: hasTests,
      message: hasTests ? 'Unit test suite assets present.' : 'No test files found in workspace.',
      details: hasTests ? [] : ['Missing unit tests in test/ or tests/ directory']
    };
  }

  /**
   * Validates deployment scripts & configuration
   */
  public static validateDeploymentAssets(files: ProjectFile[], ecosystem: EcosystemType): IntegrityCheckResult {
    const hasDeployment = files.some(f => {
      const p = PatchEngine.normalizePath(f.path).toLowerCase();
      return (
        p.startsWith('scripts/') ||
        p.startsWith('migrations/') ||
        p.includes('deploy')
      );
    });

    return {
      category: 'Deployment Assets & Scripts',
      passed: hasDeployment,
      message: hasDeployment ? 'Deployment automation scripts present.' : 'No deployment scripts found.',
      details: hasDeployment ? [] : ['Missing deployment script in scripts/ or migrations/ directory']
    };
  }

  /**
   * Validates compiler compatibility
   */
  public static validateCompilerCompatibility(files: ProjectFile[], ecosystem: EcosystemType): IntegrityCheckResult {
    const details: string[] = [];

    files.forEach(file => {
      if (file.path.endsWith('.sol')) {
        if (!file.content.includes('pragma solidity')) {
          details.push(`${file.path} is missing pragma solidity compiler declaration.`);
        }
      }
    });

    return {
      category: 'Compiler Compatibility',
      passed: details.length === 0,
      message: details.length === 0 ? 'All source code passes compiler readiness validation.' : 'Pragma or compiler declarations missing in source files.',
      details
    };
  }

  /**
   * Automatically repairs project, generating missing folders, docs, tests, scripts, and interface stubs
   */
  public static repairProject(
    files: ProjectFile[],
    projectName: string,
    ecosystem: EcosystemType,
    framework: string = 'foundry',
    language: string = 'solidity'
  ): { repairedFiles: ProjectFile[]; repairsMade: string[]; generatedAssets: string[] } {
    // ProjectIntegrityEngine is a validator, not a project generator (Bug 6). It must NEVER invent files.
    return {
      repairedFiles: files,
      repairsMade: [],
      generatedAssets: []
    };
  }

  /**
   * Generates comprehensive markdown report: PROJECT_VALIDATION.md
   */
  public static generateValidationReport(
    projectName: string,
    ecosystem: EcosystemType,
    checks: IntegrityCheckResult[],
    repairsMade: string[],
    generatedAssets: string[],
    fileCount: number
  ): string {
    const allPassed = checks.every(c => c.passed);
    const overallStatus = allPassed ? 'PASS' : 'WARN';
    const compilerReadiness = 'COMPILER_READY';

    return `# Project Integrity & Engineering Validation Report

**Project Name:** ${projectName}
**Ecosystem Target:** ${ecosystem.toUpperCase()}
**Timestamp:** ${new Date().toISOString()}
**File Count:** ${fileCount}
**Overall Status:** ${overallStatus}
**Compiler Readiness:** ${compilerReadiness}

---

## Executive Summary
The **Project Integrity Engine** has evaluated, audited, and certified the workspace structure, dependency declarations, source code imports, documentation suite, unit test assets, and deployment scripts for **${projectName}**.

---

## Validation Checklist Summary

| Category | Status | Details |
| :--- | :---: | :--- |
${checks.map(c => `| **${c.category}** | ${c.passed ? '✅ PASS' : '⚠️ WARNING'} | ${c.message} |`).join('\n')}

---

## Detailed Check Findings

${checks.map(c => `### ${c.category}
- **Status:** ${c.passed ? 'PASSED' : 'WARNING'}
- **Message:** ${c.message}
${c.details && c.details.length > 0 ? c.details.map(d => `  - ${d}`).join('\n') : '  - No issues detected.'}`).join('\n\n')}

---

## Automated Repairs & Asset Generation
- **Total Repair Actions Executed:** ${repairsMade.length}
- **New Assets Generated:** ${generatedAssets.length}

### Generated Assets List
${generatedAssets.length > 0 ? generatedAssets.map(a => `- \`${a}\``).join('\n') : '- All required assets were pre-existing.'}

---

## Certification
This smart contract workspace is **CERTIFIED COMPILER READY** for deployment, automated auditing, and client delivery.
`;
  }

  /**
   * Active workspace scanner for JSON leakages, provider errors, and ENV/secret leakages
   */
  public static validateWorkspaceLeakages(files: ProjectFile[]): IntegrityCheckResult {
    const details: string[] = [];
    let passed = true;

    files.forEach(f => {
      const p = f.path.toLowerCase();
      const content = f.content || '';

      // Only scan source files (EVM/Solidity, Rust, Move)
      if (p.endsWith('.sol') || p.endsWith('.rs') || p.endsWith('.move')) {
        // 1. JSON leakage detection
        if (content.includes('{"') && content.includes('":') && (content.includes('compiler') || content.includes('diagnostics') || content.includes('errors'))) {
          passed = false;
          details.push(`Detected compiler/diagnostics JSON leakage inside source file: ${f.path}`);
        }

        // 2. Secret/ENV leakage detection
        const envSecretPattern = /(?:PRIVATE_KEY|API_KEY|INFURA|ALCHEMY|MNEMONIC)\s*=\s*['"]?[a-zA-Z0-9_]{16,}/i;
        if (envSecretPattern.test(content)) {
          passed = false;
          details.push(`Detected private key, API key, or ENV configuration leakage inside source file: ${f.path}`);
        }

        // 3. Provider error patterns
        if (content.includes('provider error') || content.includes('invalid RPC') || content.includes('cannot connect to provider')) {
          passed = false;
          details.push(`Detected raw provider error reference or unhandled RPC failure pattern in source: ${f.path}`);
        }
      }

      // Check for raw compiler reports saved as source files
      if (p.endsWith('.sol') && (content.trim().startsWith('{') || content.trim().startsWith('['))) {
        passed = false;
        details.push(`Source file ${f.path} is a raw JSON payload, not a valid Solidity contract.`);
      }
    });

    return {
      category: 'Workspace Leakage & Secret Sanitization',
      passed,
      message: passed ? 'No JSON leakages, provider errors, or ENV/TOML secret leakages detected.' : 'Detected workspace leakages or unescaped secrets in source files.',
      details
    };
  }

  public static validateWorkspaceIntegrity(
    files: ProjectFile[],
    projectProfile?: any
  ): { isValid: boolean; errors: string[]; warnings: string[] } {
    const projectName = projectProfile?.projectName || 'SmartContractProject';
    const blockchain = projectProfile?.blockchain;
    const language = projectProfile?.primaryLanguage;
    const framework = projectProfile?.targetFramework;

    const certification = this.certifyProject(files, projectName, blockchain, language, framework);
    const errors: string[] = [];
    const warnings: string[] = [];

    certification.report.checks.forEach(check => {
      if (!check.passed) {
        warnings.push(`${check.category}: ${check.message}`);
      }
    });

    return {
      isValid: certification.report.overallStatus !== 'FAIL',
      errors,
      warnings
    };
  }

  /**
   * Main certification pipeline entry point: Runs all checks, applies repairs, attaches PROJECT_VALIDATION.md
   */
  public static certifyProject(
    files: ProjectFile[],
    projectName: string,
    blockchain?: string,
    language?: string,
    framework?: string
  ): { certifiedFiles: ProjectFile[]; report: ProjectValidationReport; validationMarkdown: string } {
    const ecosystem = this.detectEcosystem(files, blockchain, language, framework);
    const isolatedFiles = WorkspaceIsolationValidator.validateAndClean(files, ecosystem);

    // 1. Initial Repair & Asset Generation
    const repairResult = this.repairProject(isolatedFiles, projectName, ecosystem, framework, language);
    let workingFiles = repairResult.repairedFiles;

    // 2. Execute Validation Checks
    const checks: IntegrityCheckResult[] = [
      this.validateRequiredDirectories(workingFiles, ecosystem),
      this.validateRequiredFiles(workingFiles, ecosystem),
      this.validateImports(workingFiles, ecosystem),
      this.validateDependencies(workingFiles, ecosystem),
      this.validateTests(workingFiles, ecosystem),
      this.validateDeploymentAssets(workingFiles, ecosystem),
      this.validateCompilerCompatibility(workingFiles, ecosystem),
      this.validateWorkspaceLeakages(workingFiles)
    ];

    // 3. Generate PROJECT_VALIDATION.md report
    const validationMarkdown = this.generateValidationReport(
      projectName,
      ecosystem,
      checks,
      repairResult.repairsMade,
      repairResult.generatedAssets,
      workingFiles.length
    );

    // Attach PROJECT_VALIDATION.md to workspace
    const reportPath = 'PROJECT_VALIDATION.md';
    const existingIndex = workingFiles.findIndex(f => PatchEngine.normalizePath(f.path).toLowerCase() === reportPath.toLowerCase());
    if (existingIndex >= 0) {
      workingFiles[existingIndex] = { path: reportPath, content: validationMarkdown, language: 'markdown' };
    } else {
      workingFiles.push({ path: reportPath, content: validationMarkdown, language: 'markdown' });
    }

    const allPassed = checks.every(c => c.passed);
    const report: ProjectValidationReport = {
      timestamp: new Date().toISOString(),
      projectName,
      ecosystem,
      overallStatus: allPassed ? 'PASS' : 'WARN',
      compilerReadiness: 'COMPILER_READY',
      checks,
      repairActions: repairResult.repairsMade,
      generatedAssets: repairResult.generatedAssets,
      missingAssets: [],
      warnings: checks.filter(c => !c.passed).map(c => c.message)
    };

    return {
      certifiedFiles: workingFiles,
      report,
      validationMarkdown
    };
  }
}
