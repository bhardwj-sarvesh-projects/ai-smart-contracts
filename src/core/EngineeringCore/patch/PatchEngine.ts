import { ProjectFile } from '../../../types';
import { sha256 } from '../utils/cryptoFallback';

export interface PatchItem {
  path: string;
  content: string;
  language?: string;
  reason?: string;
}

export interface PatchResult {
  modifiedFiles?: PatchItem[];
  newFiles?: PatchItem[];
  deletedFiles?: string[];
  files?: PatchItem[];
  summary?: string;
  audit?: any;
}

export interface PatchWorkspaceSnapshot {
  snapshotId: string;
  timestamp: string;
  files: ProjectFile[];
  hashes: Record<string, string>;
}

export class PatchEngine {
  /**
   * Calculates SHA-256 hash of a file's normalized path and content
   */
  static computeFileHash(filePath: string, content: string): string {
    const normPath = this.normalizePath(filePath).toLowerCase();
    return sha256(`${normPath}:${content}`);
  }

  /**
   * Creates an immutable deep copy snapshot of current workspace files
   */
  static createSnapshot(files: ProjectFile[]): ProjectFile[] {
    if (!Array.isArray(files)) return [];
    return files.map(f => ({
      path: String(f.path || ''),
      content: String(f.content || ''),
      language: String(f.language || 'solidity')
    }));
  }

  /**
   * Creates an immutable snapshot with pre-patch SHA-256 hashes
   */
  static createSnapshotWithHashes(files: ProjectFile[]): PatchWorkspaceSnapshot {
    const cleanFiles = this.createSnapshot(files);
    const hashes: Record<string, string> = {};
    for (const f of cleanFiles) {
      const norm = this.normalizePath(f.path).toLowerCase();
      hashes[norm] = sha256(f.content);
    }
    return {
      snapshotId: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      files: cleanFiles,
      hashes
    };
  }

  /**
   * Normalizes path string (trim, slashes, leading ./ or /)
   */
  static normalizePath(filePath: string): string {
    if (!filePath) return '';
    return filePath.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
  }

  /**
   * Validates patch scope and prevents path traversal, provider errors, and unexpected file modifications
   */
  static validatePatchScope(
    patchResult: PatchResult,
    allowedTargetFiles: string[],
    snapshot?: ProjectFile[]
  ): { valid: boolean; reason?: string } {
    if (!patchResult || typeof patchResult !== 'object') {
      return { valid: false, reason: 'Patch result is empty or not an object' };
    }

    const normAllowed = new Set(
      allowedTargetFiles.map(p => this.normalizePath(p).toLowerCase())
    );

    const checkItem = (item: any, isNew = false): { valid: boolean; reason?: string } => {
      if (!item || typeof item !== 'object') {
        return { valid: false, reason: 'Invalid patch item' };
      }
      const rawPath = String(item.path || '').trim();
      if (!rawPath) {
        return { valid: false, reason: 'Patch item missing path' };
      }

      // 1. Path traversal / absolute path checks
      if (
        rawPath.includes('..') ||
        rawPath.startsWith('/') ||
        /^[a-zA-Z]:/.test(rawPath) ||
        rawPath.includes('\\..')
      ) {
        return { valid: false, reason: `Path traversal or absolute path detected: ${rawPath}` };
      }

      const normPath = this.normalizePath(rawPath).toLowerCase();

      // 2. Forbidden internal / diagnostic files
      if (
        normPath.startsWith('.diagnostics/') ||
        normPath.startsWith('node_modules/') ||
        normPath.endsWith('compilation_report.md') ||
        normPath.endsWith('security_report.md') ||
        normPath.endsWith('evidence_manifest.json') ||
        normPath.endsWith('checksums.txt') ||
        normPath.endsWith('delivery_summary.md')
      ) {
        return { valid: false, reason: `Modification of internal system file forbidden: ${rawPath}` };
      }

      // 3. Target Scope check
      if (normAllowed.size > 0 && !normAllowed.has(normPath)) {
        return { valid: false, reason: `File '${rawPath}' is outside allowed remediation scope` };
      }

      // 4. Content sanity check
      if (typeof item.content === 'string') {
        const content = item.content;
        if (
          content.includes('PROVIDER_ERROR') ||
          content.includes('RATE_LIMIT_ERROR') ||
          content.includes('CONTEXT_TOKEN_ERROR') ||
          content.includes('429 Too Many Requests') ||
          content.includes('[SERVER ERROR]') ||
          content.includes('Gemini Error') ||
          content.includes('Rate limit') ||
          content.includes('Quota exceeded')
        ) {
          return { valid: false, reason: `Patch content in '${rawPath}' contains AI provider error message` };
        }
      }

      return { valid: true };
    };

    const modified = patchResult.modifiedFiles || patchResult.files || [];
    for (const item of modified) {
      const res = checkItem(item, false);
      if (!res.valid) return res;
    }

    const newFiles = patchResult.newFiles || [];
    for (const item of newFiles) {
      const res = checkItem(item, true);
      if (!res.valid) return res;
    }

    const deletedFiles = patchResult.deletedFiles || [];
    for (const dPath of deletedFiles) {
      const rawPath = String(dPath || '').trim();
      if (rawPath.includes('..') || rawPath.startsWith('/') || /^[a-zA-Z]:/.test(rawPath)) {
        return { valid: false, reason: `Path traversal in deleted file: ${rawPath}` };
      }
      const normPath = this.normalizePath(rawPath).toLowerCase();
      if (normAllowed.size > 0 && !normAllowed.has(normPath)) {
        return { valid: false, reason: `Deletion of '${rawPath}' is outside allowed remediation scope` };
      }
    }

    return { valid: true };
  }

  /**
   * Verifies that after applying a patch, ONLY allowed target files changed
   */
  static verifyPatchImmutability(
    originalSnapshot: ProjectFile[],
    patchedFiles: ProjectFile[],
    allowedTargetFiles: string[]
  ): { valid: boolean; reason?: string } {
    const normAllowed = new Set(
      allowedTargetFiles.map(p => this.normalizePath(p).toLowerCase())
    );

    const origMap = new Map<string, string>();
    for (const f of originalSnapshot) {
      const norm = this.normalizePath(f.path).toLowerCase();
      origMap.set(norm, sha256(f.content));
    }

    const patchedMap = new Map<string, string>();
    for (const f of patchedFiles) {
      const norm = this.normalizePath(f.path).toLowerCase();
      patchedMap.set(norm, sha256(f.content));
    }

    // Check every file from original snapshot that is NOT in allowedTargetFiles
    for (const [normPath, origHash] of origMap.entries()) {
      if (!normAllowed.has(normPath)) {
        const patchedHash = patchedMap.get(normPath);
        if (patchedHash === undefined) {
          return { valid: false, reason: `Unrelated file '${normPath}' was unexpectedly deleted` };
        }
        if (patchedHash !== origHash) {
          return { valid: false, reason: `Unrelated file '${normPath}' was unexpectedly modified` };
        }
      }
    }

    // Check no new files were created outside allowedTargetFiles
    for (const normPath of patchedMap.keys()) {
      if (!origMap.has(normPath) && !normAllowed.has(normPath)) {
        return { valid: false, reason: `Unexpected new file '${normPath}' created outside target scope` };
      }
    }

    return { valid: true };
  }

  /**
   * Verifies that rollback restored workspace to exact pre-patch state using SHA-256 hashes
   */
  static verifyRollback(
    prePatchHashes: Record<string, string>,
    restoredFiles: ProjectFile[]
  ): { valid: boolean; reason?: string } {
    const restoredMap = new Map<string, string>();
    for (const f of restoredFiles) {
      const norm = this.normalizePath(f.path).toLowerCase();
      restoredMap.set(norm, sha256(f.content));
    }

    for (const [normPath, preHash] of Object.entries(prePatchHashes)) {
      const restoredHash = restoredMap.get(normPath);
      if (restoredHash === undefined) {
        return { valid: false, reason: `Rollback integrity failed: file '${normPath}' is missing after rollback` };
      }
      if (restoredHash !== preHash) {
        return { valid: false, reason: `Rollback integrity failed: hash mismatch for file '${normPath}'` };
      }
    }

    if (restoredMap.size !== Object.keys(prePatchHashes).length) {
      return { valid: false, reason: 'Rollback integrity failed: extra files present after rollback' };
    }

    return { valid: true };
  }

  /**
   * Merges patch overlay into snapshot, guaranteeing non-modified files stay byte-for-byte untouched
   */
  static applyPatch(snapshot: ProjectFile[], patchResult: PatchResult): ProjectFile[] {
    const cleanSnapshot = this.createSnapshot(snapshot);
    if (!patchResult || typeof patchResult !== 'object') {
      return cleanSnapshot;
    }

    // 1. Collect all patch items
    const patchesMap = new Map<string, PatchItem>();

    const addPatchItem = (item: any) => {
      if (!item || !item.path || typeof item.content !== 'string') return;
      const normPath = this.normalizePath(item.path);
      if (!normPath) return;

      // Clean content (strip accidental wrapping markdown fences if present)
      let cleanContent = item.content.trim();
      const fenceMatch = cleanContent.match(/^```(?:[a-zA-Z0-9_-]+)?\s*[\r\n]([\s\S]*?)[\r\n]```$/);
      if (fenceMatch && fenceMatch[1]) {
        cleanContent = fenceMatch[1].trim();
      }

      patchesMap.set(normPath.toLowerCase(), {
        path: item.path.trim(),
        content: cleanContent,
        language: item.language || 'solidity',
        reason: item.reason
      });
    };

    // Process modifiedFiles and newFiles
    if (Array.isArray(patchResult.modifiedFiles)) {
      patchResult.modifiedFiles.forEach(addPatchItem);
    }
    if (Array.isArray(patchResult.newFiles)) {
      patchResult.newFiles.forEach(addPatchItem);
    }

    // Process fallback files array if provided and modifiedFiles/newFiles were empty
    if (patchesMap.size === 0 && Array.isArray(patchResult.files)) {
      patchResult.files.forEach(addPatchItem);
    }

    // If no patches provided at all, return snapshot untouched
    if (patchesMap.size === 0) {
      return cleanSnapshot;
    }

    // 2. Overlay patches onto snapshot copy
    const mergedFiles: ProjectFile[] = [];
    const updatedNormPaths = new Set<string>();

    for (const file of cleanSnapshot) {
      const normPath = this.normalizePath(file.path).toLowerCase();
      if (patchesMap.has(normPath)) {
        const patch = patchesMap.get(normPath)!;
        mergedFiles.push({
          path: file.path, // Preserve original casing & path
          content: patch.content,
          language: patch.language || file.language || 'solidity'
        });
        updatedNormPaths.add(normPath);
      } else {
        // UNTOUCHED FILE: Keep byte-for-byte identical
        mergedFiles.push({ ...file });
      }
    }

    // 3. Append brand new files that were not in snapshot
    for (const [normPath, patch] of patchesMap.entries()) {
      if (!updatedNormPaths.has(normPath)) {
        mergedFiles.push({
          path: patch.path,
          content: patch.content,
          language: patch.language || 'solidity'
        });
      }
    }

    // 4. Handle deleted files ONLY if explicitly requested and safe
    if (Array.isArray(patchResult.deletedFiles) && patchResult.deletedFiles.length > 0) {
      const toDeleteNorms = new Set(
        patchResult.deletedFiles.map(p => this.normalizePath(String(p)).toLowerCase())
      );

      for (let i = mergedFiles.length - 1; i >= 0; i--) {
        const normPath = this.normalizePath(mergedFiles[i].path).toLowerCase();
        if (toDeleteNorms.has(normPath)) {
          // Protection rule: do not delete documentation, tests, deployment scripts, or interfaces unless explicitly intended
          const isProtected =
            normPath.endsWith('.md') ||
            normPath.includes('license') ||
            normPath.startsWith('test/') ||
            normPath.startsWith('tests/') ||
            normPath.startsWith('script/') ||
            normPath.startsWith('scripts/') ||
            normPath.startsWith('interfaces/') ||
            normPath.startsWith('libraries/');

          if (!isProtected || patchResult.deletedFiles?.length === 1) {
            mergedFiles.splice(i, 1);
          }
        }
      }
    }

    // 5. Final validation of merged workspace
    const isValid = this.validateWorkspaceIntegrity(cleanSnapshot, mergedFiles);
    if (!isValid.valid) {
      console.warn(`[PATCH ENGINE ROLLBACK] Validation failed: ${isValid.reason}. Restoring snapshot.`);
      return cleanSnapshot;
    }

    return mergedFiles;
  }

  /**
   * Validates workspace integrity after patching
   */
  static validateWorkspaceIntegrity(originalSnapshot: ProjectFile[], mergedFiles: ProjectFile[]): { valid: boolean; reason?: string } {
    if (!Array.isArray(mergedFiles) || mergedFiles.length === 0) {
      return { valid: false, reason: 'Merged workspace is empty' };
    }

    // Check if any file content is blank/null
    const hasInvalidFile = mergedFiles.some(f => !f || !f.path || typeof f.content !== 'string' || f.content.trim().length === 0);
    if (hasInvalidFile) {
      return { valid: false, reason: 'Merged workspace contains empty or invalid file content' };
    }

    // Ensure non-modified files were preserved
    if (originalSnapshot.length > 1 && mergedFiles.length < Math.floor(originalSnapshot.length * 0.5)) {
      return { valid: false, reason: 'Drastic file deletion detected during patch operation' };
    }

    return { valid: true };
  }
}

