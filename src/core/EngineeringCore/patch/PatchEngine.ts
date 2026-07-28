import { ProjectFile } from '../../../types';

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

export class PatchEngine {
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
   * Normalizes path string (trim, slashes, leading ./ or /)
   */
  static normalizePath(filePath: string): string {
    if (!filePath) return '';
    return filePath.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
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
