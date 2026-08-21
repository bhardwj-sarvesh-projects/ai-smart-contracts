import { ProjectFile } from '../../../types';
import { PatchEngine } from '../patch/PatchEngine';
import { sha256 } from '../utils/cryptoFallback';
import { getNodeRequire } from '../utils/nodeRequire';

// Safe dynamic require helper to bypass browser bundle static analysis
const requireFn = getNodeRequire();
const fs = requireFn ? requireFn('fs') : null;
const path = requireFn ? requireFn('path') : null;
const os = requireFn ? requireFn('os') : null;
const spawnSync = requireFn ? requireFn('child_process').spawnSync : null;
// NOTE: Node's `crypto` module is intentionally NOT required here anymore.
// certifyCompilation() runs in both server (Node) and client (browser)
// contexts, and workspace-hash evidence must never depend on a Node-only
// API. `sha256()` (../utils/cryptoFallback) is a pure-JS implementation
// that works identically in both runtimes, so hashing can never throw
// CRYPTO_UNAVAILABLE regardless of where this engine executes.

export type CompilerType =
  | 'solc'
  | 'forge'
  | 'hardhat'
  | 'anchor'
  | 'solang'
  | 'scarb'
  | 'cargo-build-bpf'
  | 'cargo-build'
  | 'aptos-move'
  | 'sui-move'
  | 'generic';

export type ErrorClassification =
  | 'Syntax'
  | 'Import'
  | 'Dependency'
  | 'Inheritance'
  | 'Visibility'
  | 'Access Control'
  | 'Undefined Event'
  | 'Undefined Error'
  | 'Undefined Variable'
  | 'Type Mismatch'
  | 'Constructor'
  | 'Trait'
  | 'Move Module'
  | 'Anchor Account'
  | 'Compiler Version'
  | 'Framework Version'
  | 'Configuration'
  | 'Unknown';

export interface CompilerDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  compiler: CompilerType;
  framework: string;
  errorCode: string;
  classification: ErrorClassification;
  message: string;
  suggestedFix: string;
}

export type CompilationStatus = "PASS" | "FAIL" | "NOT_VERIFIED";
export type CompilerVerificationMode = "REAL_EXECUTION" | "TOOLCHAIN_UNAVAILABLE";

export interface CompilationResult {
  timestamp: string;
  projectName: string;
  compiler: CompilerType;
  framework: string;
  compilerVersion: string;
  success: boolean;
  filesCompiled: number;
  diagnostics: CompilerDiagnostic[];
  errors: CompilerDiagnostic[];
  warnings: CompilerDiagnostic[];
  repairAttempts: number;
  modifiedFiles: string[];
  compilationTimeMs: number;
  status: CompilationStatus;
  reportMarkdown: string;

  // Real execution evidence properties
  command: string;
  workspace: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  workspaceHash: string;
  verificationMode: CompilerVerificationMode;
}

export class CompilerEngine {
  public static spawnSyncFn = spawnSync;

  private static computeSha256(content: string): string {
    return sha256(content);
  }

  /**
   * Detect compiler required for the workspace
   */
  public static detectCompiler(
    files: ProjectFile[] | string = [],
    blockchain?: string,
    framework?: string
  ): CompilerType {
    if (typeof files === 'string') {
      const tempFw = blockchain;
      blockchain = files;
      framework = tempFw;
      files = [];
    }
    const fileList = Array.isArray(files) ? files : [];
    const b = (blockchain || '').toLowerCase();
    const f = (framework || '').toLowerCase();

    if (f === 'solang' || b.includes('solang')) {
      return 'solang';
    }
    if (f === 'scarb' || b.includes('starknet') || b.includes('scarb')) {
      return 'scarb';
    }
    if (f.includes('anchor') || (b.includes('solana') && !f.includes('solang'))) {
      return 'anchor';
    }
    if (b.includes('aptos')) {
      return 'aptos-move';
    }
    if (b.includes('sui')) {
      return 'sui-move';
    }
    if (f.includes('foundry') || f.includes('forge')) {
      return 'forge';
    }
    if (f.includes('hardhat')) {
      return 'hardhat';
    }

    // Inspect files
    const paths = fileList.map(file => PatchEngine.normalizePath(file.path).toLowerCase());
    if (paths.some(p => p.includes('anchor.toml'))) return 'anchor';
    if (paths.some(p => p.includes('foundry.toml'))) return 'forge';
    if (paths.some(p => p.includes('hardhat.config'))) return 'hardhat';
    if (paths.some(p => p.includes('move.toml'))) {
      const isSui = fileList.some(file => file.content.includes('sui::'));
      return isSui ? 'sui-move' : 'aptos-move';
    }

    if (paths.some(p => p.endsWith('.sol'))) return 'forge';
    if (paths.some(p => p.endsWith('.rs'))) return 'anchor';
    if (paths.some(p => p.endsWith('.move'))) return 'aptos-move';

    return 'solc';
  }

  /**
   * Detect framework name
   */
  public static detectFramework(files: ProjectFile[], inputFramework?: string): string {
    if (inputFramework && inputFramework.trim().length > 0) return inputFramework;
    const compiler = this.detectCompiler(files);
    switch (compiler) {
      case 'forge':
        return 'Foundry';
      case 'hardhat':
        return 'Hardhat';
      case 'anchor':
        return 'Anchor Framework';
      case 'aptos-move':
        return 'Aptos Framework';
      case 'sui-move':
        return 'Sui Framework';
      default:
        return 'Standard Solc Toolchain';
    }
  }

  /**
   * Classify compiler error messages into granular category types
   */
  public static classifyErrors(message: string, code?: string): ErrorClassification {
    const msg = message.toLowerCase();

    if (msg.includes('syntax') || msg.includes('expected') || msg.includes('parsererror')) {
      return 'Syntax';
    }
    if (msg.includes('import') || msg.includes('not found') || msg.includes('file not found')) {
      return 'Import';
    }
    if (msg.includes('undeclared identifier') || msg.includes('not found in this scope')) {
      return 'Undefined Variable';
    }
    if (msg.includes('event') && (msg.includes('not found') || msg.includes('undeclared'))) {
      return 'Undefined Event';
    }
    if (msg.includes('error') && (msg.includes('not found') || msg.includes('undeclared custom'))) {
      return 'Undefined Error';
    }
    if (msg.includes('type') || msg.includes('cannot convert') || msg.includes('type mismatch')) {
      return 'Type Mismatch';
    }
    if (msg.includes('inheritance') || msg.includes('override') || msg.includes('is missing interface')) {
      return 'Inheritance';
    }
    if (msg.includes('visibility') || msg.includes('public') || msg.includes('private') || msg.includes('external')) {
      return 'Visibility';
    }
    if (msg.includes('access') || msg.includes('onlyowner') || msg.includes('unauthorized')) {
      return 'Access Control';
    }
    if (msg.includes('constructor')) {
      return 'Constructor';
    }
    if (msg.includes('trait') || msg.includes('impl')) {
      return 'Trait';
    }
    if (msg.includes('move') || msg.includes('module') || msg.includes('resource')) {
      return 'Move Module';
    }
    if (msg.includes('account') || msg.includes('context') || msg.includes('anchor')) {
      return 'Anchor Account';
    }
    if (msg.includes('version') || msg.includes('pragma')) {
      return 'Compiler Version';
    }
    if (msg.includes('config') || msg.includes('toml') || msg.includes('json')) {
      return 'Configuration';
    }

    return 'Unknown';
  }

  /**
   * Parses raw compiler output text into structured CompilerDiagnostic items
   */
  public static parseCompilerOutput(
    rawLogs: string,
    compiler: CompilerType,
    framework: string
  ): CompilerDiagnostic[] {
    const diagnostics: CompilerDiagnostic[] = [];
    if (!rawLogs || rawLogs.trim().length === 0) return diagnostics;

    const lines = rawLogs.split('\n');

    // Robust patterns
    const solcSingleRegex = /^(.+?\.sol):(\d+):(\d+):\s*(Error|Warning|Info|ParserError|TypeError|DeclarationError):\s*(.+)$/i;
    const solcGeneralErrorRegex = /^(Error|Warning|ParserError|TypeError|DeclarationError|DocstringParsingError|SyntaxError)(?:\s*\(\d+\))?:\s*(.+)$/i;
    const locationRegex = /^\s*-->\s*(.+?\.sol|.+?\.rs|.+?\.move):(\d+):(\d+)/i;
    
    const rustErrorRegex = /error(?:\[(E\d+)\])?: (.*)/i;
    const rustLocationRegex = /--> (.+?\.rs):(\d+):(\d+)/i;
    
    const moveLocationRegex = /(?:error|warning):?\s*(.*)\s*-->\s*(.+?\.move):(\d+):(\d+)/i;

    let pendingSeverity: 'error' | 'warning' = 'error';
    let pendingMessage = '';
    let pendingClassification: ErrorClassification = 'Unknown';
    let pendingErrorCode = '';

    let currentFile = '';
    let currentLine = 1;
    let currentCol = 1;

    for (let i = 0; i < lines.length; i++) {
      const lineStr = lines[i].trim();
      if (!lineStr) continue;

      // 1. Single-line Solidity match
      const solSingleMatch = solcSingleRegex.exec(lineStr);
      if (solSingleMatch) {
        const filePath = PatchEngine.normalizePath(solSingleMatch[1]);
        const lineNum = parseInt(solSingleMatch[2], 10) || 1;
        const colNum = parseInt(solSingleMatch[3], 10) || 1;
        const severityStr = solSingleMatch[4].toLowerCase();
        const sev: 'error' | 'warning' = (severityStr.includes('warning') || severityStr.includes('info')) ? 'warning' : 'error';
        const msg = solSingleMatch[5];
        const classification = this.classifyErrors(msg);

        diagnostics.push({
          file: filePath,
          line: lineNum,
          column: colNum,
          severity: sev,
          compiler,
          framework,
          errorCode: classification,
          classification,
          message: msg,
          suggestedFix: this.getSuggestedFix(classification, msg, filePath)
        });
        // Reset pending
        pendingMessage = '';
        continue;
      }

      // 2. Move match
      const moveMatch = moveLocationRegex.exec(lineStr);
      if (moveMatch) {
        const msg = moveMatch[1] || 'Move compilation diagnostic';
        const filePath = PatchEngine.normalizePath(moveMatch[2]);
        const lineNum = parseInt(moveMatch[3], 10) || 1;
        const colNum = parseInt(moveMatch[4], 10) || 1;
        const classification = this.classifyErrors(msg);

        diagnostics.push({
          file: filePath,
          line: lineNum,
          column: colNum,
          severity: 'error',
          compiler,
          framework,
          errorCode: classification,
          classification,
          message: msg,
          suggestedFix: this.getSuggestedFix(classification, msg, filePath)
        });
        continue;
      }

      // 3. Rust Location match
      const rustLoc = rustLocationRegex.exec(lineStr);
      if (rustLoc) {
        currentFile = PatchEngine.normalizePath(rustLoc[1]);
        currentLine = parseInt(rustLoc[2], 10) || 1;
        currentCol = parseInt(rustLoc[3], 10) || 1;
      }

      // 4. Rust Error match
      const rustErr = rustErrorRegex.exec(lineStr);
      if (rustErr && currentFile) {
        const code = rustErr[1] || 'RustError';
        const msg = rustErr[2];
        const classification = this.classifyErrors(msg, code);

        diagnostics.push({
          file: currentFile,
          line: currentLine,
          column: currentCol,
          severity: 'error',
          compiler,
          framework,
          errorCode: code,
          classification,
          message: msg,
          suggestedFix: this.getSuggestedFix(classification, msg, currentFile)
        });
        currentFile = '';
        continue;
      }

      // 5. Multi-line location match (Solidity, etc.)
      const locMatch = locationRegex.exec(lineStr);
      if (locMatch && pendingMessage) {
        const filePath = PatchEngine.normalizePath(locMatch[1]);
        const lineNum = parseInt(locMatch[2], 10) || 1;
        const colNum = parseInt(locMatch[3], 10) || 1;

        diagnostics.push({
          file: filePath,
          line: lineNum,
          column: colNum,
          severity: pendingSeverity,
          compiler,
          framework,
          errorCode: pendingErrorCode || pendingClassification,
          classification: pendingClassification,
          message: pendingMessage,
          suggestedFix: this.getSuggestedFix(pendingClassification, pendingMessage, filePath)
        });

        pendingMessage = ''; // consumed
        continue;
      }

      // 6. Standalone general error match (such as ParserError: ... or Error: ...)
      const generalMatch = solcGeneralErrorRegex.exec(lineStr);
      if (generalMatch) {
        // If we already have a pending message that wasn't matched with a location, push it anyway with default location
        if (pendingMessage) {
          const defaultFile = compiler === 'forge' || compiler === 'hardhat' || compiler === 'solc' ? 'contracts/Contract.sol' : 'src/lib.rs';
          diagnostics.push({
            file: defaultFile,
            line: 1,
            column: 1,
            severity: pendingSeverity,
            compiler,
            framework,
            errorCode: pendingErrorCode || pendingClassification,
            classification: pendingClassification,
            message: pendingMessage,
            suggestedFix: this.getSuggestedFix(pendingClassification, pendingMessage, defaultFile)
          });
        }

        const typeStr = generalMatch[1].toLowerCase();
        pendingSeverity = (typeStr.includes('warning') || typeStr.includes('info')) ? 'warning' : 'error';
        pendingMessage = generalMatch[2];
        pendingClassification = this.classifyErrors(pendingMessage);
        pendingErrorCode = pendingClassification;
        continue;
      }
    }

    // Handle any leftover pending message at the end of logs
    if (pendingMessage) {
      const defaultFile = compiler === 'forge' || compiler === 'hardhat' || compiler === 'solc' ? 'contracts/Contract.sol' : 'src/lib.rs';
      diagnostics.push({
        file: defaultFile,
        line: 1,
        column: 1,
        severity: pendingSeverity,
        compiler,
        framework,
        errorCode: pendingErrorCode || pendingClassification,
        classification: pendingClassification,
        message: pendingMessage,
        suggestedFix: this.getSuggestedFix(pendingClassification, pendingMessage, defaultFile)
      });
    }

    return diagnostics;
  }

  /**
   * Generates actionable suggested fix advice based on error classification
   */
  private static getSuggestedFix(classification: ErrorClassification, message: string, file: string): string {
    switch (classification) {
      case 'Syntax':
        return `Check semicolon, closing braces, or keyword spelling near line in ${file}.`;
      case 'Import':
        return `Verify import path and target file existence in ${file}.`;
      case 'Undefined Event':
        return `Declare missing event definition in ${file} or inherited interface.`;
      case 'Undefined Error':
        return `Declare missing custom error signature (error CustomError();) in ${file}.`;
      case 'Undefined Variable':
        return `Declare variable or check parameter naming scope in ${file}.`;
      case 'Type Mismatch':
        return `Cast variable types explicitly or adjust signature types in ${file}.`;
      case 'Inheritance':
        return `Implement missing virtual interface functions or add 'override' modifier in ${file}.`;
      case 'Visibility':
        return `Specify explicit visibility modifier (public, external, internal, private) in ${file}.`;
      default:
        return `Review compiler diagnostic error log for ${file} and adjust declaration.`;
    }
  }



  public static resolveForgePath(): string {
    const candidatePaths = [
      '/root/.foundry/bin/forge',
      '/usr/local/bin/forge',
      '/usr/bin/forge'
    ];
    if (fs) {
      for (const cp of candidatePaths) {
        try {
          if (fs.existsSync(cp)) return cp;
        } catch {}
      }
    }
    return 'forge';
  }

  private static resolveHardhatBinary(workspacePath: string): { binary: string; args: string[] } | null {
    if (!fs || !path) return null;
    const name = process.platform === 'win32' ? 'hardhat.cmd' : 'hardhat';
    const localBin = path.join(workspacePath, 'node_modules', '.bin', name);
    try { if (fs.existsSync(localBin)) return { binary: localBin, args: ['--version'] }; } catch {}
    return null;
  }

  public static isBinaryAvailable(binary: string, args: string[] = ['--version']): boolean {
    const spawnSyncFn = this.spawnSyncFn || spawnSync;
    if (!spawnSyncFn) return false;
    try {
      const res = spawnSyncFn(binary, args, { encoding: 'utf8', timeout: 5000 });
      return res && res.status === 0;
    } catch {
      return false;
    }
  }

  /**
   * Main Compiler Certification Pipeline Entrypoint
   * Executes actual compilers on isolated workspace copy
   */
  public static certifyCompilation(
    files: ProjectFile[],
    projectName: string,
    blockchain?: string,
    framework?: string,
    language?: string
  ): { certifiedFiles: ProjectFile[]; result: CompilationResult } {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();
    const compiler = this.detectCompiler(files, blockchain, framework);
    const frameworkName = this.detectFramework(files, framework);

    const filesToHash = files.map(f => `${f.path}:${this.computeSha256(f.content)}`).sort().join('\n');
    const workspaceHash = this.computeSha256(filesToHash);

    // `process` is a Node global and does not exist in the browser bundle.
    // Referencing it unconditionally (the previous behavior) threw
    // `ReferenceError: process is not defined` the instant this function
    // ran client-side -- immediately after the crypto fix above, this was
    // the *next* latent crash in the same call. `typeof process !== 'undefined'`
    // is safe to evaluate even when `process` was never declared.
    const tmpBase = (os && os.tmpdir)
      ? os.tmpdir()
      : (typeof process !== 'undefined' && process.cwd ? process.cwd() : '/tmp');
    const workspacePath = path
      ? path.resolve(tmpBase, 'compiler_workspace_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7))
      : 'N/A';

    let isAvailable = false;
    let binary = '';
    let args: string[] = [];
    let detectedVersion = '';

    const spawnSyncFn = this.spawnSyncFn || spawnSync;

    if (compiler === 'forge') {
      binary = this.resolveForgePath();
      args = ['build'];
      isAvailable = this.isBinaryAvailable(binary, ['--version']);
      if (isAvailable && spawnSyncFn) {
        const vRes = spawnSyncFn(binary, ['--version'], { encoding: 'utf8' });
        detectedVersion = (vRes.stdout || '').trim();
      }
    } else if (compiler === 'hardhat') {
      const resolved = this.resolveHardhatBinary(workspacePath);
      if (resolved) {
        binary = resolved.binary;
        args = ['compile'];
        isAvailable = this.isBinaryAvailable(binary, ['--version']);
      } else {
        binary = 'npx';
        args = ['hardhat', 'compile'];
        isAvailable = this.isBinaryAvailable(binary, ['hardhat', '--version']);
      }
      if (isAvailable && spawnSyncFn) {
        const checkArgs = args[0] === 'hardhat' ? ['hardhat', '--version'] : ['--version'];
        const vRes = spawnSyncFn(binary, checkArgs, { encoding: 'utf8', cwd: workspacePath });
        detectedVersion = (vRes.stdout || '').trim();
      }
    } else if (compiler === 'anchor') {
      binary = 'anchor';
      args = ['build'];
      isAvailable = this.isBinaryAvailable(binary, ['--version']);
      if (isAvailable && spawnSyncFn) {
        const vRes = spawnSyncFn(binary, ['--version'], { encoding: 'utf8' });
        detectedVersion = (vRes.stdout || '').trim();
      }
    } else if (compiler === 'aptos-move') {
      binary = 'aptos';
      args = ['move', 'compile'];
      isAvailable = this.isBinaryAvailable(binary, ['--version']);
      if (isAvailable && spawnSyncFn) {
        const vRes = spawnSyncFn(binary, ['--version'], { encoding: 'utf8' });
        detectedVersion = (vRes.stdout || '').trim();
      }
    } else if (compiler === 'sui-move') {
      binary = 'sui';
      args = ['move', 'build'];
      isAvailable = this.isBinaryAvailable(binary, ['--version']);
      if (isAvailable && spawnSyncFn) {
        const vRes = spawnSyncFn(binary, ['--version'], { encoding: 'utf8' });
        detectedVersion = (vRes.stdout || '').trim();
      }
    } else if (compiler === 'solang') {
      binary = 'solang';
      args = ['compile'];
      isAvailable = this.isBinaryAvailable(binary, ['--version']);
      if (isAvailable && spawnSyncFn) {
        const vRes = spawnSyncFn(binary, ['--version'], { encoding: 'utf8' });
        detectedVersion = (vRes.stdout || '').trim();
      }
    } else if (compiler === 'scarb') {
      binary = 'scarb';
      args = ['build'];
      isAvailable = this.isBinaryAvailable(binary, ['--version']);
      if (isAvailable && spawnSyncFn) {
        const vRes = spawnSyncFn(binary, ['--version'], { encoding: 'utf8' });
        detectedVersion = (vRes.stdout || '').trim();
      }
    } else if (compiler === 'solc') {
      binary = 'solc';
      const solFiles = files.filter(f => f.path.endsWith('.sol')).map(f => f.path);
      args = ['--bin', '--abi', ...solFiles];
      isAvailable = this.isBinaryAvailable(binary, ['--version']);
      if (isAvailable && spawnSyncFn) {
        const vRes = spawnSyncFn(binary, ['--version'], { encoding: 'utf8' });
        detectedVersion = (vRes.stdout || '').trim();
      }
    }

    let status: CompilationStatus = 'NOT_VERIFIED';
    let verificationMode: CompilerVerificationMode = 'TOOLCHAIN_UNAVAILABLE';
    let exitCode: number | null = null;
    let stdout = '';
    let stderr = '';
    let durationMs = 0;

    if (isAvailable && spawnSyncFn && fs && path) {
      verificationMode = 'REAL_EXECUTION';
      const timeoutMs = 120000; // 120 seconds

      try {
        if (fs.existsSync(workspacePath)) {
          fs.rmSync(workspacePath, { recursive: true, force: true });
        }
        fs.mkdirSync(workspacePath, { recursive: true });

        files.forEach(f => {
          const normalizedPath = PatchEngine.normalizePath(f.path);
          const fullPath = path.join(workspacePath, normalizedPath);
          const dirPath = path.dirname(fullPath);
          if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
          }
          fs.writeFileSync(fullPath, f.content, 'utf8');
        });

        const res = spawnSyncFn(binary, args, {
          encoding: 'utf8',
          cwd: workspacePath,
          timeout: timeoutMs
        });

        durationMs = Date.now() - startTime;

        if (res.error) {
          const isTimeout = (res.error as any).code === 'ETIMEDOUT' || res.signal === 'SIGTERM' || res.signal === 'SIGKILL';
          status = 'FAIL';
          exitCode = isTimeout ? 124 : 1;
          stdout = res.stdout || '';
          stderr = res.stderr || `PROCESS_ERROR: ${res.error.message}${isTimeout ? ' (TIMEOUT)' : ''}`;
        } else {
          exitCode = res.status !== null ? res.status : 1;
          stdout = res.stdout || '';
          stderr = res.stderr || '';
          status = (exitCode === 0) ? 'PASS' : 'FAIL';
        }

        try {
          fs.rmSync(workspacePath, { recursive: true, force: true });
        } catch {}
      } catch (err: any) {
        status = 'FAIL';
        exitCode = 1;
        stderr = err.message || String(err);
        durationMs = Date.now() - startTime;
      }
    } else {
      status = 'NOT_VERIFIED';
      verificationMode = 'TOOLCHAIN_UNAVAILABLE';
      stderr = 'TOOLCHAIN_UNAVAILABLE: Required compiler toolchain is not available or execution environment is limited.';
      durationMs = Date.now() - startTime;
    }

    const success = (status === 'PASS');
    const diagnostics = (verificationMode === 'REAL_EXECUTION') 
      ? this.parseCompilerOutput(stdout + '\n' + stderr, compiler, frameworkName)
      : [];

    const errors = diagnostics.filter(d => d.severity === 'error');
    const warnings = diagnostics.filter(d => d.severity === 'warning');

    const completedAt = new Date().toISOString();
    const command = verificationMode === 'REAL_EXECUTION' ? `${binary} ${args.join(' ')}`.trim() : 'N/A';
    const finalWorkspacePath = verificationMode === 'REAL_EXECUTION' ? workspacePath : 'N/A';

    const reportMarkdown = this.generateCompilationReport(
      projectName,
      compiler,
      frameworkName,
      success,
      files.length,
      diagnostics,
      0, // Repair attempts is strictly 0 (no auto-repair)
      [], // Modified files is strictly empty (no auto-repair)
      durationMs
    );

    const certifiedFiles = [...files];
    const reportPath = 'COMPILATION_REPORT.md';
    const existingIdx = certifiedFiles.findIndex(f => PatchEngine.normalizePath(f.path).toLowerCase() === reportPath.toLowerCase());
    if (existingIdx >= 0) {
      certifiedFiles[existingIdx] = { path: reportPath, content: reportMarkdown, language: 'markdown' };
    } else {
      certifiedFiles.push({ path: reportPath, content: reportMarkdown, language: 'markdown' });
    }

    const result: CompilationResult = {
      timestamp: completedAt,
      projectName,
      compiler,
      framework: frameworkName,
      compilerVersion: detectedVersion || 'UNKNOWN',
      success,
      filesCompiled: files.length,
      diagnostics,
      errors,
      warnings,
      repairAttempts: 0,
      modifiedFiles: [],
      compilationTimeMs: durationMs,
      status,
      reportMarkdown,

      command,
      workspace: finalWorkspacePath,
      startedAt,
      completedAt,
      durationMs,
      exitCode,
      stdout,
      stderr,
      workspaceHash,
      verificationMode
    };

    // Immutability Check
    const postFilesToHash = files.map(f => `${f.path}:${this.computeSha256(f.content)}`).sort().join('\n');
    const postWorkspaceHash = this.computeSha256(postFilesToHash);
    if (workspaceHash !== postWorkspaceHash) {
      throw new Error("CompilerEngine source mutation detected! Source immutability violation.");
    }

    return {
      certifiedFiles,
      result
    };
  }

  public static generateCompilationReport(
    projectName: string,
    compiler: CompilerType,
    framework: string,
    success: boolean,
    filesCompiled: number,
    diagnostics: CompilerDiagnostic[],
    repairAttempts: number,
    modifiedFiles: string[],
    timeMs: number
  ): string {
    const errors = diagnostics.filter(d => d.severity === 'error');
    const warnings = diagnostics.filter(d => d.severity === 'warning');

    return `# Compiler Intelligence Report

**Project Name:** ${projectName}
**Target Compiler:** ${compiler.toUpperCase()}
**Framework:** ${framework}
**Timestamp:** ${new Date().toISOString()}
**Compilation Status:** ${success ? '✅ PASSED' : '❌ FAILED'}
**Files Compiled:** ${filesCompiled}
**Compilation Time:** ${timeMs} ms

---

## Executive Summary
The **Compiler Intelligence Engine** performed compilation and diagnostic classification for **${projectName}**.

---

## Diagnostics Overview
- **Total Diagnostics:** ${diagnostics.length}
- **Fatal Errors:** ${errors.length}
- **Warnings:** ${warnings.length}

### Classified Diagnostic Items
${diagnostics.length > 0 ? diagnostics.map(d => `- **[${d.severity.toUpperCase()}] ${d.file}:${d.line}:${d.column}** (${d.classification}): ${d.message}\n  *Suggested Fix:* ${d.suggestedFix}`).join('\n') : '- No compiler errors or warnings detected.'}

---

## Final Certification
- **Compiler Readiness:** ${success ? 'CERTIFIED FOR STAGE GATE' : 'BLOCKED - COMPILER ERRORS DETECTED'}
`;
  }

  public static compile(
    files: ProjectFile[],
    projectName: string = 'SmartContractProject',
    blockchain?: string,
    framework?: string,
    language?: string
  ) {
    if (!Array.isArray(files)) throw new Error("CompilerEngine.compile: files must be an array");
    const cert = this.certifyCompilation(files, projectName, blockchain, framework, language);
    if (!cert || !cert.certifiedFiles) throw new Error("CompilerEngine returned invalid result");
    return cert;
  }

  public static certify(
    files: ProjectFile[],
    projectName: string = 'SmartContractProject',
    blockchain?: string,
    framework?: string,
    language?: string
  ) {
    return this.compile(files, projectName, blockchain, framework, language);
  }

  public static validate(
    files: ProjectFile[],
    projectName: string = 'SmartContractProject',
    blockchain?: string,
    framework?: string,
    language?: string
  ) {
    return this.compile(files, projectName, blockchain, framework, language);
  }
}
