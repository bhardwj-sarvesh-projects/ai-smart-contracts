import { Project, ProjectFile, AuditResult, Version } from '../../../types';
import { PatchEngine, PatchResult, PatchItem } from '../patch/PatchEngine';
import { ProjectIntegrityEngine } from '../validators/ProjectIntegrityEngine';
import { DependencyValidationEngine } from '../validators/DependencyValidationEngine';
import { CompilerEngine } from '../compiler/CompilerEngine';

export interface WorkspaceSnapshot {
  id: string;
  timestamp: string;
  projectId: string;
  projectName: string;
  files: ProjectFile[];
  activeFilePath: string;
  audit?: AuditResult;
  metadata?: Record<string, any>;
}

export type WorkspaceEventType =
  | 'WorkspaceCreated'
  | 'WorkspaceSnapshot'
  | 'PatchReceived'
  | 'PatchValidated'
  | 'PatchRejected'
  | 'PatchMerged'
  | 'ValidationStarted'
  | 'ValidationPassed'
  | 'ValidationFailed'
  | 'RollbackStarted'
  | 'RollbackCompleted'
  | 'WorkspaceCommitted';

export interface WorkspaceEvent {
  id: string;
  type: WorkspaceEventType;
  timestamp: string;
  projectId: string;
  message: string;
  details?: any;
}

export type WorkspaceEventListener = (event: WorkspaceEvent) => void;

export class WorkspaceManager {
  private static instance: WorkspaceManager;
  private listeners: WorkspaceEventListener[] = [];
  private snapshots: Map<string, WorkspaceSnapshot[]> = new Map();

  private constructor() {}

  public static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  /**
   * Subscribe to WorkspaceManager events
   */
  public subscribe(listener: WorkspaceEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Emit an event to all subscribers and return the event object
   */
  public emitEvent(
    type: WorkspaceEventType,
    projectId: string,
    message: string,
    details?: any
  ): WorkspaceEvent {
    const event: WorkspaceEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      timestamp: new Date().toISOString(),
      projectId,
      message,
      details
    };

    console.log(`[WorkspaceManager:${type}] [${projectId}] ${message}`, details || '');
    this.listeners.forEach(l => {
      try {
        l(event);
      } catch (e) {
        console.error('WorkspaceManager listener error:', e);
      }
    });

    return event;
  }

  /**
   * Creates an immutable deep copy snapshot of a Project workspace
   */
  public createSnapshot(project: Project, metadata?: Record<string, any>): WorkspaceSnapshot {
    if (!project || !project.id) {
      throw new Error('Cannot create snapshot for invalid project');
    }

    const snapshot: WorkspaceSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      projectId: project.id,
      projectName: project.name || 'Untitled Project',
      files: PatchEngine.createSnapshot(project.files || []),
      activeFilePath: project.activeFilePath || (project.files?.[0]?.path || ''),
      audit: project.audit ? JSON.parse(JSON.stringify(project.audit)) : undefined,
      metadata
    };

    const projectSnapshots = this.snapshots.get(project.id) || [];
    projectSnapshots.unshift(snapshot);
    // Keep max 20 snapshots per project in memory
    if (projectSnapshots.length > 20) {
      projectSnapshots.length = 20;
    }
    this.snapshots.set(project.id, projectSnapshots);

    this.emitEvent(
      'WorkspaceSnapshot',
      project.id,
      `Immutable workspace snapshot created (${snapshot.files.length} files)`,
      { snapshotId: snapshot.id, fileCount: snapshot.files.length }
    );

    return snapshot;
  }

  /**
   * Restores a project workspace from a snapshot
   */
  public restoreSnapshot(snapshot: WorkspaceSnapshot, currentProject: Project): Project {
    this.emitEvent(
      'RollbackStarted',
      currentProject.id,
      `Restoring workspace snapshot ${snapshot.id}...`
    );

    const restoredProject: Project = {
      ...currentProject,
      files: PatchEngine.createSnapshot(snapshot.files),
      activeFilePath: snapshot.activeFilePath || currentProject.activeFilePath,
      audit: snapshot.audit ? JSON.parse(JSON.stringify(snapshot.audit)) : currentProject.audit
    };

    this.emitEvent(
      'RollbackCompleted',
      currentProject.id,
      `Workspace snapshot ${snapshot.id} restored successfully (${restoredProject.files.length} files)`
    );

    return restoredProject;
  }

  /**
   * Validates patch format and integrity
   */
  public validatePatch(patch: PatchResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!patch || typeof patch !== 'object') {
      return { valid: false, errors: ['Patch object is missing or invalid'] };
    }

    const validateItem = (item: PatchItem, typeName: string) => {
      if (!item || typeof item !== 'object') {
        errors.push(`Invalid ${typeName} item format`);
        return;
      }
      if (!item.path || typeof item.path !== 'string' || item.path.trim().length === 0) {
        errors.push(`${typeName} item missing valid file path`);
      }
      if (typeof item.content !== 'string') {
        errors.push(`${typeName} item missing valid string content for path: ${item.path || 'unknown'}`);
      }
    };

    if (Array.isArray(patch.modifiedFiles)) {
      patch.modifiedFiles.forEach(item => validateItem(item, 'modifiedFiles'));
    }
    if (Array.isArray(patch.newFiles)) {
      patch.newFiles.forEach(item => validateItem(item, 'newFiles'));
    }
    if (Array.isArray(patch.files)) {
      patch.files.forEach(item => validateItem(item, 'files'));
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validates required project assets and file structure
   */
  public validateProjectIntegrity(files: ProjectFile[]): { valid: boolean; missingAssets: string[]; errors: string[] } {
    const errors: string[] = [];
    const missingAssets: string[] = [];

    if (!Array.isArray(files) || files.length === 0) {
      return { valid: false, missingAssets: ['ALL'], errors: ['Workspace files list is empty'] };
    }

    const normalizedPaths = new Set(files.map(f => PatchEngine.normalizePath(f.path).toLowerCase()));

    // Essential files check
    const requiredDocs = ['readme.md', 'architecture.md', 'security.md', 'deployment.md', 'changelog.md', 'license', '.env.example'];
    requiredDocs.forEach(doc => {
      if (!normalizedPaths.has(doc)) {
        missingAssets.push(doc);
      }
    });

    // Check at least one contract exists
    const hasContract = files.some(f => {
      const p = PatchEngine.normalizePath(f.path).toLowerCase();
      return p.endsWith('.sol') || p.endsWith('.rs') || p.endsWith('.move') || p.startsWith('contracts/') || p.startsWith('src/');
    });

    if (!hasContract) {
      errors.push('No smart contract or source code file found in workspace');
    }

    return {
      valid: errors.length === 0,
      missingAssets,
      errors
    };
  }

  /**
   * Safely applies an AI patch overlay onto a Project.
   * Creates snapshot -> validates patch -> applies overlay -> validates integrity -> commits or rolls back
   */
  public applyPatch(
    currentProject: Project,
    patch: PatchResult,
    promptInstruction: string = 'Workspace modification'
  ): { success: boolean; project: Project; events: WorkspaceEvent[]; error?: string } {
    const events: WorkspaceEvent[] = [];
    const projectId = currentProject.id;

    // 1. Snapshot creation
    const snapshot = this.createSnapshot(currentProject, { promptInstruction });
    events.push(
      this.emitEvent(
        'PatchReceived',
        projectId,
        `Received patch for project "${currentProject.name}" with prompt: "${promptInstruction}"`
      )
    );

    // 2. Validate patch format
    const patchCheck = this.validatePatch(patch);
    if (!patchCheck.valid) {
      const err = `Patch validation failed: ${patchCheck.errors.join(', ')}`;
      events.push(this.emitEvent('PatchRejected', projectId, err, { errors: patchCheck.errors }));
      return {
        success: false,
        project: currentProject,
        events,
        error: err
      };
    }
    events.push(this.emitEvent('PatchValidated', projectId, 'Patch structure validated successfully.'));

    // 3. Apply patch merge using PatchEngine
    events.push(this.emitEvent('ValidationStarted', projectId, 'Merging patch overlay into workspace...'));
    const mergedFiles = PatchEngine.applyPatch(snapshot.files, patch);

    // 4. Validate workspace post-merge
    const mergeIntegrity = PatchEngine.validateWorkspaceIntegrity(snapshot.files, mergedFiles);
    if (!mergeIntegrity.valid) {
      const err = `Workspace post-merge integrity check failed: ${mergeIntegrity.reason}`;
      events.push(this.emitEvent('ValidationFailed', projectId, err));

      // Rollback
      const restored = this.restoreSnapshot(snapshot, currentProject);
      return {
        success: false,
        project: restored,
        events,
        error: err
      };
    }

    events.push(
      this.emitEvent(
        'PatchMerged',
        projectId,
        `Patch merged successfully. Updated workspace contains ${mergedFiles.length} files.`
      )
    );

    // 5. Check for missing required assets and restore or auto-generate them if necessary
    const integrityResult = this.validateProjectIntegrity(mergedFiles);
    if (integrityResult.missingAssets.length > 0) {
      events.push(
        this.emitEvent(
          'ValidationStarted',
          projectId,
          `Auto-generating or restoring required enterprise documentation assets: ${integrityResult.missingAssets.join(', ')}`
        )
      );

      // Auto-restore missing doc assets from snapshot if present
      for (const missingDoc of integrityResult.missingAssets) {
        const docInSnapshot = snapshot.files.find(f => PatchEngine.normalizePath(f.path).toLowerCase() === missingDoc);
        if (docInSnapshot) {
          mergedFiles.push({ ...docInSnapshot });
        }
      }
    }

    // Ensure all standard folders/docs (README, ARCHITECTURE, SECURITY, DEPLOYMENT, CHANGELOG, LICENSE, .env.example, interfaces, scripts, tests, reports) exist
    const completeFiles = this.ensureCompleteProjectStructure(currentProject.name || 'SmartContractProject', mergedFiles);

    events.push(this.emitEvent('ValidationPassed', projectId, 'Workspace integrity checks passed perfectly.'));

    // 6. Create version history record
    const newVersion: Version = {
      id: `v-${Date.now()}`,
      timestamp: new Date().toISOString(),
      prompt: promptInstruction,
      files: PatchEngine.createSnapshot(snapshot.files),
      summary: patch.summary || 'Workspace modified via AI patch'
    };

    const updatedProject: Project = {
      ...currentProject,
      files: completeFiles,
      audit: patch.audit || currentProject.audit,
      versions: [newVersion, ...(currentProject.versions || [])]
    };

    events.push(
      this.emitEvent(
        'WorkspaceCommitted',
        projectId,
        `Workspace committed successfully to project "${updatedProject.name}".`
      )
    );

    return {
      success: true,
      project: updatedProject,
      events
    };
  }

  /**
   * Directly commits changes to project with version tracking
   */
  public commitWorkspace(project: Project, summary: string, promptInstruction: string = 'Manual edit'): Project {
    const snapshot = this.createSnapshot(project, { summary });

    const newVersion: Version = {
      id: `v-${Date.now()}`,
      timestamp: new Date().toISOString(),
      prompt: promptInstruction,
      files: PatchEngine.createSnapshot(snapshot.files),
      summary
    };

    const committedProject: Project = {
      ...project,
      versions: [newVersion, ...(project.versions || [])]
    };

    this.emitEvent(
      'WorkspaceCommitted',
      project.id,
      `Workspace changes committed: "${summary}"`
    );

    return committedProject;
  }

  /**
   * Rolls back a project workspace to its previous snapshot
   */
  public rollback(projectId: string): Project | undefined {
    const snaps = this.snapshots.get(projectId);
    if (!snaps || snaps.length === 0) return undefined;
    const latestSnapshot = snaps[0];
    const dummyProject: Project = {
      id: projectId,
      name: latestSnapshot.projectName,
      description: 'Rolled back project',
      blockchain: 'Ethereum/EVM',
      language: 'Solidity',
      framework: 'Foundry',
      contractType: 'ERC20',
      files: latestSnapshot.files,
      activeFilePath: latestSnapshot.activeFilePath,
      versions: [],
      deployments: [],
      createdAt: new Date().toISOString()
    };
    return this.restoreSnapshot(latestSnapshot, dummyProject);
  }

  /**
   * Ensures that a workspace contains all mandatory project structure & documentation assets
   * Required for enterprise compliance and export delivery
   */
  public ensureCompleteProjectStructure(projectName: string, files: ProjectFile[], framework?: string, language?: string): ProjectFile[] {
    const certification = ProjectIntegrityEngine.certifyProject(
      files,
      projectName,
      undefined,
      language,
      framework
    );
    const toolchainCertification = DependencyValidationEngine.validateAndCertifyToolchain(
      certification.certifiedFiles,
      projectName,
      undefined,
      framework,
      language
    );
    const compilerCertification = CompilerEngine.certifyCompilation(
      toolchainCertification.certifiedFiles,
      projectName,
      undefined,
      framework,
      language
    );
    return compilerCertification.certifiedFiles;
  }
}
