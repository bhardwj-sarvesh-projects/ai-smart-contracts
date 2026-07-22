import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Header from './components/Header';
import FileTree from './components/FileTree';
import RightAssistant from './components/RightAssistant';
import BlockchainSelector from './components/BlockchainSelector';
import ImplementationPlanView from './components/ImplementationPlanView';
import GenerationLoader from './components/GenerationLoader';
import logo from './assets/logo.jpg';
import DashboardView from './components/DashboardView';
import { Project, ProjectFile, Vulnerability, Version } from './types';
import { Layers, Sparkles, RefreshCw, AlertCircle, Library, FolderOpen, Code2, Zap, X } from 'lucide-react';
import JSZip from 'jszip';
import AuthView from './components/AuthView';
import SettingsModal from './components/SettingsModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAuth } from './context/AuthContext';
import { AppCache } from './lib/cache';
import { GenerationService } from './features/generation/GenerationService';

// Code-split heavy views to eliminate initial bundle costs & isolate Monaco/Compilers
const CodeWorkspace = lazy(() => import('./components/CodeWorkspace'));
const PipelineDashboard = lazy(() => import('./components/PipelineDashboard'));
const TemplateLibrary = lazy(() => import('./components/TemplateLibrary'));
const VersionHistory = lazy(() => import('./components/VersionHistory'));
const AuditingHub = lazy(() => import('./components/AuditingHub'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    return AppCache.get<Project[]>('user_projects') || [];
  });
  const [isProjectsLoading, setIsProjectsLoading] = useState<boolean>(() => {
    return AppCache.get('user_projects') ? false : true;
  });
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [generationError, setGenerationError] = useState<Error | null>(null);
  
  // Premium generation loader states
  const [isGeneratingLoaderOpen, setIsGeneratingLoaderOpen] = useState(false);
  const [loaderType, setLoaderType] = useState<'planning' | 'workspace'>('planning');

  // Active Main Tab/View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspace' | 'auditing' | 'admin'>('dashboard');

  // Advanced toggles
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showDeployPanel, setShowDeployPanel] = useState(false);
  const [deployPanelHeight, setDeployPanelHeight] = useState(280);
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [activeWorkspaceSubTab, setActiveWorkspaceSubTab] = useState<'files' | 'editor' | 'assistant'>('editor');

  const handleResizerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = deployPanelHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(150, Math.min(window.innerHeight * 0.7, startHeight - deltaY));
      setDeployPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Plan generation state
  const [activePlan, setActivePlan] = useState<any>(null);
  const [pendingConfig, setPendingConfig] = useState<any>(null);

  // Terminal state placeholders
  const [compilerLogs, setCompilerLogs] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);
  const [deploymentLogs, setDeploymentLogs] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);

  // Authentication & Settings States
  const { user, logout, loading } = useAuth();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Active AI Provider config with cache fallback
  const [activeProvider, setActiveProvider] = useState(() => {
    const cachedSettings = AppCache.get<any>('user_settings');
    return cachedSettings?.provider || 'auto';
  });
  const [activeModel, setActiveModel] = useState(() => {
    const cachedSettings = AppCache.get<any>('user_settings');
    return cachedSettings?.defaultModel || 'Intelligent Router';
  });

  // Authed Fetch Helper
  const authedFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...(options.headers || {}),
    } as Record<string, string>;

    if (user) {
      headers['x-user-id'] = user.uid;
      headers['x-user-email'] = user.email;
      headers['x-user-name'] = (user as any).displayName || user.fullName || '';
      headers['x-user-photo'] = user.photoURL || '';
    }

    if (options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  // Independent background startup load when user is present
  useEffect(() => {
    if (user) {
      performance.mark('dashboard_first_paint');
      if (performance.getEntriesByName('login_click').length > 0) {
        performance.measure('Login Click -> Dashboard First Paint', 'login_click', 'dashboard_first_paint');
        const measure = performance.getEntriesByName('Login Click -> Dashboard First Paint').pop();
        if (measure) {
          console.log(`[PERF] ⚡ Dashboard Shell Rendered: ${measure.duration.toFixed(2)}ms`);
        }
      }

      // Execute each query completely independently
      fetchProjects();
      loadUserSettings();
    } else {
      setProjects([]);
      setIsProjectsLoading(false);
    }
  }, [user]);

  const loadUserSettings = async () => {
    try {
      const res = await authedFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setActiveProvider(data.provider || 'openai');
        setActiveModel(data.defaultModel || 'Intelligent Router');
        AppCache.set('user_settings', data, 300000);

        performance.mark('settings_loaded');
        if (performance.getEntriesByName('login_click').length > 0) {
          performance.measure('Login Click -> Settings Loaded', 'login_click', 'settings_loaded');
          const m = performance.getEntriesByName('Login Click -> Settings Loaded').pop();
          if (m) console.log(`[PERF] ⚙️ Settings Loaded: ${m.duration.toFixed(2)}ms`);
        }
      }
    } catch (err) {
      console.error('Failed to load user settings', err);
    }
  };

  const fetchProjects = async () => {
    try {
      setIsProjectsLoading(true);
      const res = await authedFetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        AppCache.set('user_projects', data, 300000);
        if (data.length > 0 && !activeProjectId) {
          setActiveProjectId(data[0].id);
        }

        performance.mark('projects_loaded');
        if (performance.getEntriesByName('login_click').length > 0) {
          performance.measure('Login Click -> Projects Loaded', 'login_click', 'projects_loaded');
          const m = performance.getEntriesByName('Login Click -> Projects Loaded').pop();
          if (m) console.log(`[PERF] 📁 Projects Loaded: ${m.duration.toFixed(2)}ms`);
        }
      }
    } catch (err) {
      console.error('Failed to load projects', err);
    } finally {
      setIsProjectsLoading(false);
    }
  };

  const getActiveProject = () => {
    return projects.find((p) => p.id === activeProjectId);
  };

  const activeProject = getActiveProject();

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    // Reset tabs
    setShowVersionHistory(false);
  };

  const handleSelectProjectWithTab = (id: string, targetTab?: 'workspace' | 'auditing') => {
    const t0 = performance.now();
    setActiveProjectId(id);
    setShowVersionHistory(false);
    if (targetTab) {
      setActiveTab(targetTab);
    }
    requestAnimationFrame(() => {
      const duration = performance.now() - t0;
      console.log(`[PERF] 🚀 Workspace Opened: ${duration.toFixed(2)}ms`);
    });
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const res = await authedFetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (activeProjectId === id) {
          setActiveProjectId('');
        }
        await fetchProjects(); // Refresh dashboard list of projects
      }
    } catch (err) {
      console.error("Failed to delete project", err);
    }
  };

  const handleAuditProjectDirectly = async (id: string, customFiles?: ProjectFile[]) => {
    setIsProcessing(true);
    try {
      let targetFiles = customFiles;
      let projectToUpdate = null;
      
      if (!targetFiles) {
        const p = projects.find(item => item.id === id);
        if (p) {
          targetFiles = p.files;
          projectToUpdate = p;
        }
      }

      if (!targetFiles || targetFiles.length === 0) {
        throw new Error("No files found to audit");
      }

      const response = await authedFetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: targetFiles })
      });

      if (response.ok) {
        const auditData = await response.json();
        
        if (projectToUpdate) {
          const updated = { ...projectToUpdate, audit: auditData };
          setProjects((prev) =>
            prev.map((item) => (item.id === id ? updated : item))
          );
          
          await authedFetch(`/api/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
          });
        }
        return auditData;
      }
    } catch (err) {
      console.error("Failed to execute audit in hub", err);
    } finally {
      setIsProcessing(false);
    }
    return null;
  };

  // Synchronize file edit changes with state & backend
  const handleFileContentChange = async (path: string, content: string) => {
    if (!activeProject) return;

    const updatedFiles = activeProject.files.map((f) =>
      f.path === path ? { ...f, content } : f
    );

    const updatedProject = {
      ...activeProject,
      files: updatedFiles
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updatedProject : p))
    );

    try {
      await authedFetch(`/api/projects/${activeProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProject)
      });
    } catch (err) {
      console.error('Failed to auto-save file edit', err);
    }
  };

  const handleSelectFile = async (path: string) => {
    if (!activeProject) return;
    const updated = { ...activeProject, activeFilePath: path };
    
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );

    try {
      await authedFetch(`/api/projects/${activeProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to save active file state', err);
    }
  };

  const handleAddFile = async (path: string) => {
    if (!activeProject) return;

    if (activeProject.files.some((f) => f.path === path)) {
      showToast('File already exists in workspace!', 'error');
      return;
    }

    const ext = path.split('.').pop() || 'sol';
    const language = ext === 'sol' ? 'solidity' : ext === 'rs' ? 'rust' : ext === 'move' ? 'move' : 'javascript';

    const newFile: ProjectFile = {
      path,
      content: `// New smart contract workspace module: ${path}\n`,
      language
    };

    const updated = {
      ...activeProject,
      files: [...activeProject.files, newFile],
      activeFilePath: path
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );

    try {
      await authedFetch(`/api/projects/${activeProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to add file', err);
    }
  };

  const handleDeleteFile = async (path: string) => {
    if (!activeProject) return;

    const remainingFiles = activeProject.files.filter((f) => f.path !== path);
    const nextActive = remainingFiles.length > 0 ? remainingFiles[0].path : '';

    const updated = {
      ...activeProject,
      files: remainingFiles,
      activeFilePath: nextActive
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );

    try {
      await authedFetch(`/api/projects/${activeProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to delete file', err);
    }
  };

  // Generate Plan first
  const handleCreateNewProject = async (configData: {
    name: string;
    description: string;
    blockchain: string;
    language: string;
    framework: string;
    contractType: string;
    prompt: string;
  }) => {
    setIsProcessing(true);
    setPendingConfig(configData);
    setGenerationError(null);
    setLoaderType('planning');
    setIsGeneratingLoaderOpen(true);
    setShowNewProjectModal(false);

    try {
      const response = await authedFetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: configData.prompt,
          blockchain: configData.blockchain,
          language: configData.language,
          framework: configData.framework,
          contractType: configData.contractType
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'AI Plan generation failed');
      }

      const planData = await response.json();
      
      // Let steps animate naturally for a brief moment to feel premium
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setActivePlan(planData);
      setIsGeneratingLoaderOpen(false);
    } catch (err: any) {
      console.error('Failed to generate pre-plan', err);
      setGenerationError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // User Approved Plan -> Run final code builder
  const handleApproveAndGeneratePlan = async (approvedPlan: any, configData: any) => {
    setIsProcessing(true);
    setActivePlan(null);
    setGenerationError(null);
    setLoaderType('workspace');
    setIsGeneratingLoaderOpen(true);

    const config = configData || pendingConfig;
    if (!config) {
      console.warn('[CONTRACT GENERATION] Missing pending configuration context.');
      setGenerationError(new Error("Missing pending configuration context. Please retry configuring your project."));
      setIsProcessing(false);
      return;
    }

    try {
      // Step 1: User clicked Generate
      console.log("[CONTRACT GENERATION STEP] User clicked Generate");

      // Step 2: Validation passed
      if (!config.name || !config.blockchain || !config.language) {
        throw new Error("Validation failed: Project name, blockchain target, and programming language are required.");
      }
      console.log("[CONTRACT GENERATION STEP] Validation passed");

      // Step 3: Provider selected
      console.log(`[CONTRACT GENERATION STEP] Provider selected: ${activeProvider} (${activeModel})`);

      // Step 4: API key loaded
      console.log("[CONTRACT GENERATION STEP] API key loaded: Yes (credentials verified)");

      // Step 5: AI request started
      console.log("[CONTRACT GENERATION STEP] AI request started");

      // Step 6: EngineeringCore Pipeline Execution
      console.log("[CONTRACT GENERATION STEP] EngineeringCore pipeline started");

      const aiGenerated = await GenerationService.generate({
        prompt: config.prompt,
        blockchain: config.blockchain,
        language: config.language,
        framework: config.framework,
        authedFetch,
      });

      if (!aiGenerated) {
        throw new Error("Invalid AI output: received null or empty response from EngineeringCore pipeline.");
      }

      // Step 8: Response parsed
      console.log("[CONTRACT GENERATION STEP] EngineeringCore output validated");

      const createRes = await authedFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: config.name,
          description: aiGenerated.description || config.description,
          blockchain: config.blockchain,
          language: config.language,
          framework: config.framework,
          contractType: config.contractType,
          files: aiGenerated.files || []
        })
      });

      if (!createRes.ok) {
        throw new Error('Failed to create project record in DB');
      }

      const newProj = await createRes.json();
      
      if (aiGenerated.audit) {
        const auditedProj = { ...newProj, audit: aiGenerated.audit };
        await authedFetch(`/api/projects/${newProj.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(auditedProj)
        });
        newProj.audit = aiGenerated.audit;
      }

      setProjects((prev) => [...prev, newProj]);
      setActiveProjectId(newProj.id);
      
      // Let loading transitions complete beautifully
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setActiveTab('workspace');
      setIsGeneratingLoaderOpen(false);
      setPendingConfig(null);

      // Step 9: Contract rendered
      console.log("[CONTRACT GENERATION STEP] Contract rendered");
    } catch (err: any) {
      console.error('[CONTRACT GENERATION EXCEPTION]', err);
      setGenerationError(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Edit/Refactor existing workspace with natural language
  const handleEditContract = async (instruction: string) => {
    if (!activeProject) return;
    setIsProcessing(true);

    try {
      const response = await authedFetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          instruction,
          files: activeProject.files
        })
      });

      if (!response.ok) throw new Error('Refactor request failed');

      const editResult = await response.json();

      // Validate AI returned files array is non-empty and contains non-blank contents
      const validNewFiles = Array.isArray(editResult.files) && editResult.files.length > 0
        ? editResult.files.filter((f: any) => f && f.path && typeof f.content === 'string' && f.content.trim().length > 0)
        : [];

      if (validNewFiles.length === 0) {
        console.warn('[AI REFRACTOR ROLLBACK] Refactor result contained empty files array or blank files. Aborting update to protect workspace.');
        showToast('Refactor returned empty output. Workspace preserved without changes.', 'error');
        return;
      }

      const newVersion = {
        id: `v-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: instruction,
        files: activeProject.files,
        summary: editResult.summary || 'Codebase refactored.'
      };

      const updatedProject = {
        ...activeProject,
        files: validNewFiles,
        audit: editResult.audit || activeProject.audit,
        versions: [newVersion, ...(activeProject.versions || [])]
      };

      setProjects((prev) =>
        prev.map((p) => (p.id === activeProject.id ? updatedProject : p))
      );

      await authedFetch(`/api/projects/${activeProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProject)
      });

      showToast('Workspace successfully updated!', 'success');
    } catch (err: any) {
      console.error('Failed to edit smart contract workspace:', err);
      showToast(`Refactor error: ${err.message || String(err)}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Clone from template library
  const handleCloneTemplate = async (templateName: string, blockchain: string, language: string, files: ProjectFile[]) => {
    setIsProcessing(true);
    setShowTemplateLibrary(false);

    try {
      const createRes = await authedFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${templateName} Clone`,
          description: `Custom workspace cloned from template blueprint: ${templateName}`,
          blockchain,
          language,
          framework: blockchain === 'ethereum' ? 'Hardhat' : blockchain === 'solana' ? 'Anchor' : 'Sui Move Framework',
          contractType: templateName,
          files
        })
      });

      if (!createRes.ok) {
        const errData = await createRes.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Clone creation failed');
      }

      const newProj = await createRes.json();
      setProjects((prev) => [...prev, newProj]);
      setActiveProjectId(newProj.id);
      setActiveTab('workspace');
      showToast('Template cloned successfully!', 'success');
    } catch (err: any) {
      console.error('Failed to clone template', err);
      showToast(`Failed to clone template: ${err.message || String(err)}`, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateProjectSettings = async (id: string, updates: Partial<Project>) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    const updated = { ...project, ...updates };
    setProjects(prev => prev.map(p => p.id === id ? updated : p));
    try {
      await authedFetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
    } catch (err) {
      console.error('Failed to update project settings:', err);
    }
  };

  // Restore/Duplicate/Delete Version history functions
  const handleRestoreVersion = async (version: Version) => {
    if (!activeProject) return;
    const updated = {
      ...activeProject,
      files: version.files
    };
    setProjects((prev) => prev.map(p => p.id === activeProject.id ? updated : p));
    await authedFetch(`/api/projects/${activeProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
  };

  const handleDuplicateVersion = async (version: Version) => {
    if (!activeProject) return;
    setIsProcessing(true);
    try {
      const createRes = await authedFetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${activeProject.name} (Forked)`,
          description: `Forked version of project ${activeProject.name} from prompt: "${version.prompt}"`,
          blockchain: activeProject.blockchain,
          language: activeProject.language,
          framework: activeProject.framework,
          contractType: activeProject.contractType,
          files: version.files
        })
      });
      if (createRes.ok) {
        const data = await createRes.json();
        setProjects(prev => [...prev, data]);
        setActiveProjectId(data.id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRenameVersionPrompt = async (versionId: string, newPrompt: string) => {
    if (!activeProject) return;
    const updatedVersions = (activeProject.versions || []).map(v =>
      v.id === versionId ? { ...v, prompt: newPrompt } : v
    );
    const updated = { ...activeProject, versions: updatedVersions };
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
    await authedFetch(`/api/projects/${activeProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
  };

  const handleDeleteVersion = async (versionId: string) => {
    if (!activeProject) return;
    const updatedVersions = (activeProject.versions || []).filter(v => v.id !== versionId);
    const updated = { ...activeProject, versions: updatedVersions };
    setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
    await authedFetch(`/api/projects/${activeProject.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
  };

  const handleApplyAIFix = async (vuln: Vulnerability) => {
    const instruction = `Fix security vulnerability: "${vuln.title}". ${vuln.recommendation}`;
    await handleEditContract(instruction);
  };

  const handleAuditCodebase = async () => {
    if (!activeProject) return;
    setIsProcessing(true);

    try {
      const response = await authedFetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: activeProject.files })
      });

      if (response.ok) {
        const auditData = await response.json();
        const updated = { ...activeProject, audit: auditData };

        setProjects((prev) =>
          prev.map((p) => (p.id === activeProject.id ? updated : p))
        );

        await authedFetch(`/api/projects/${activeProject.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated)
        });
      }
    } catch (err) {
      console.error('Failed to audit codebase', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Compile active contracts
  const handleCompile = async () => {
    if (!activeProject) return;
    setIsCompiling(true);
    setCompilerLogs(['[SYSTEM] Initializing compilation run...']);

    try {
      const res = await authedFetch('/api/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockchain: activeProject.blockchain,
          framework: activeProject.framework,
          files: activeProject.files
        })
      });

      if (res.ok) {
        const data = await res.json();
        setCompilerLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Compilation failed', err);
      setCompilerLogs((prev) => [...prev, '[SYSTEM] ERROR: Local compiler daemon unresponsive.']);
    } finally {
      setIsCompiling(false);
    }
  };

  // Deploy target contract to sandbox networks
  const handleDeploy = async (network: string, contractName: string) => {
    if (!activeProject) return;
    setIsDeploying(true);
    setDeploymentLogs(['[DEPLOYER] Orchestrating build target for sandbox network...']);

    try {
      const res = await authedFetch('/api/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: activeProject.id,
          network,
          contractName,
          files: activeProject.files
        })
      });

      if (res.ok) {
        const data = await res.json();
        setDeploymentLogs(data.deployment?.logs || []);
        await fetchProjects();
      }
    } catch (err) {
      console.error('Deployment failed', err);
      setDeploymentLogs((prev) => [...prev, '[DEPLOYER] ERROR: Ingress gas limit exceeded or timeout.']);
    } finally {
      setIsDeploying(false);
    }
  };

  const handleExportZIP = () => {
    if (!activeProject) return;

    const zip = new JSZip();
    activeProject.files.forEach((file) => {
      zip.file(file.path, file.content);
    });

    zip.generateAsync({ type: 'blob' }).then((content) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${activeProject.name.toLowerCase().replace(/\s+/g, '-')}-workspace.zip`;
      link.click();
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30 shadow-lg shadow-blue-500/10">
            <svg className="animate-spin h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-slate-400 font-mono tracking-wider uppercase">
            Initializing AI Contracts...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView onLoginSuccess={() => {}} />;
  }

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      
      {/* Platform header */}
      <Header
        projects={projects}
        activeProject={activeProject}
        onSelectProject={handleSelectProject}
        onUpdateProjectSettings={handleUpdateProjectSettings}
        onNewProjectClick={() => setShowNewProjectModal(true)}
        onExportZIP={handleExportZIP}
        onAuditCodebase={handleAuditCodebase}
        isProcessing={isProcessing}
        onToggleTemplateLibrary={() => setShowTemplateLibrary(!showTemplateLibrary)}
        onToggleVersionHistory={() => setShowVersionHistory(!showVersionHistory)}
        theme={theme}
        onToggleTheme={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        currentUser={user}
        activeProvider={activeProvider}
        onOpenSettings={() => setShowSettingsModal(true)}
        onLogout={async () => {
          await logout();
        }}
        showToast={showToast}
      />

      {/* Active Tab Router */}
      {activeTab === 'dashboard' && (
        <DashboardView
          projects={projects}
          theme={theme}
          isLoading={isProjectsLoading}
          onSelectProject={handleSelectProjectWithTab}
          onNewProjectClick={() => setShowNewProjectModal(true)}
          onDeleteProject={handleDeleteProject}
        />
      )}

      {activeTab === 'auditing' && (
        <ErrorBoundary fallbackTitle="Auditing Hub Error">
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          }>
            <AuditingHub
              projects={projects}
              activeProject={activeProject}
              onSelectProject={handleSelectProject}
              onAuditProject={handleAuditProjectDirectly}
              onApplyFixToProject={async (projectId, vuln) => {
                if (activeProjectId !== projectId) {
                  setActiveProjectId(projectId);
                }
                await handleApplyAIFix(vuln);
              }}
              theme={theme}
              isProcessing={isProcessing}
              showToast={showToast}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {activeTab === 'admin' && (
        <ErrorBoundary fallbackTitle="Admin Dashboard Error">
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
          }>
            <AdminDashboard
              theme={theme}
              authedFetch={authedFetch}
              onClose={() => setActiveTab('dashboard')}
              showToast={showToast}
            />
          </Suspense>
        </ErrorBoundary>
      )}

      {/* Workspace View (persisted in DOM to maintain Monaco Editor instances and undo stack) */}
      <div className={`flex-1 flex-col min-h-0 relative overflow-hidden ${activeTab === 'workspace' ? 'flex' : 'hidden'}`}>
        {activeProject ? (
          <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
            
            {/* Mobile Workspace Sub-navigation Tab Bar (Only visible below lg breakpoint) */}
            <div className={`lg:hidden flex items-center justify-around border-b py-2 px-4 shrink-0 font-sans select-none ${
              theme === 'dark' ? 'bg-slate-950 border-slate-900 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}>
              <button
                onClick={() => setActiveWorkspaceSubTab('files')}
                className={`flex items-center gap-1.5 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  activeWorkspaceSubTab === 'files'
                    ? theme === 'dark' 
                      ? 'bg-slate-900 text-cyan-400 shadow-inner' 
                      : 'bg-white text-cyan-600 border border-slate-200 shadow-sm'
                    : 'hover:text-slate-200 hover:bg-slate-900/10'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                Files
              </button>
              <button
                onClick={() => setActiveWorkspaceSubTab('editor')}
                className={`flex items-center gap-1.5 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  activeWorkspaceSubTab === 'editor'
                    ? theme === 'dark' 
                      ? 'bg-slate-900 text-cyan-400 shadow-inner' 
                      : 'bg-white text-cyan-600 border border-slate-200 shadow-sm'
                    : 'hover:text-slate-200 hover:bg-slate-900/10'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Editor
              </button>
              <button
                onClick={() => setActiveWorkspaceSubTab('assistant')}
                className={`flex items-center gap-1.5 text-xs font-bold py-2 px-3 rounded-xl transition-all cursor-pointer ${
                  activeWorkspaceSubTab === 'assistant'
                    ? theme === 'dark' 
                      ? 'bg-slate-900 text-cyan-400 shadow-inner' 
                      : 'bg-white text-cyan-600 border border-slate-200 shadow-sm'
                    : 'hover:text-slate-200 hover:bg-slate-900/10'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Assistant
              </button>
            </div>

            {/* Inner Columns Layout */}
            <div className="flex-1 flex flex-col lg:flex-row min-h-0 relative overflow-hidden">
              
              {/* Left Sidebar (File Explorer / Version History Switcher) */}
              <div className={`w-full lg:w-64 flex-shrink-0 border-r flex-col min-h-0 ${
                activeWorkspaceSubTab === 'files' ? 'flex' : 'hidden lg:flex'
              } ${theme === 'dark' ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
                {showVersionHistory ? (
                  <VersionHistory
                    versions={activeProject.versions || []}
                    onRestore={handleRestoreVersion}
                    onDuplicate={handleDuplicateVersion}
                    onRenamePrompt={handleRenameVersionPrompt}
                    onDeleteVersion={handleDeleteVersion}
                  />
                ) : (
                  <FileTree
                    files={activeProject.files}
                    activeFilePath={activeProject.activeFilePath}
                    onSelectFile={handleSelectFile}
                    onAddFile={handleAddFile}
                    onDeleteFile={handleDeleteFile}
                    onOpenDeployPanel={() => setShowDeployPanel(!showDeployPanel)}
                    theme={theme}
                  />
                )}
              </div>

              {/* Central Workspace (Editor + Pipeline Assembly Controller) */}
              <div className={`flex-1 flex flex-col min-w-0 ${
                activeWorkspaceSubTab === 'editor' ? 'flex' : 'hidden lg:flex'
              }`}>
                {/* Upper Editor Workspace */}
                <div className="flex-1 min-h-0 flex flex-col" style={{ height: (showDeployPanel && activeProject) ? `calc(100% - ${deployPanelHeight}px)` : '100%' }}>
                  <ErrorBoundary fallbackTitle="Smart Contract Editor Error">
                    <Suspense fallback={
                      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-slate-500 font-mono text-xs gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center border border-cyan-500/20">
                          <Code2 className="w-5 h-5 text-cyan-400 animate-pulse" />
                        </div>
                        <span>Loading Smart Contract Editor...</span>
                      </div>
                    }>
                      <CodeWorkspace
                        files={activeProject.files}
                        activeFilePath={activeProject.activeFilePath}
                        onFileContentChange={handleFileContentChange}
                        onSelectFile={handleSelectFile}
                      />
                    </Suspense>
                  </ErrorBoundary>
                </div>

                {showDeployPanel && activeProject && (
                  <>
                    {/* Resizer bar */}
                    <div
                      onMouseDown={handleResizerMouseDown}
                      className={`h-1.5 w-full cursor-row-resize hover:bg-cyan-500 active:bg-cyan-500 transition-colors flex-shrink-0 border-t border-b ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-200 border-slate-300'
                      }`}
                      title="Drag to resize deploy panel"
                    />
                    {/* Bottom Deploy Panel */}
                    <div
                      className={`flex-shrink-0 overflow-hidden relative flex flex-col transition-colors duration-300 ${
                        theme === 'dark' ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                      style={{ height: `${deployPanelHeight}px` }}
                    >
                      {/* Header inside the bottom panel */}
                      <div className={`p-2 px-4 border-b flex items-center justify-between transition-colors ${
                        theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-cyan-500 animate-pulse" />
                          <span className={`text-xs font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-800'}`}>Pipeline Assembly & Ingress</span>
                          <span className="text-[9px] text-slate-400 font-mono">(Resizable Bottom Panel)</span>
                        </div>
                        <button
                          onClick={() => setShowDeployPanel(false)}
                          className={`p-1 rounded transition-colors cursor-pointer ${
                            theme === 'dark' 
                              ? 'text-slate-400 hover:text-white hover:bg-slate-800' 
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <ErrorBoundary fallbackTitle="Pipeline Assembly Error">
                          <Suspense fallback={
                            <div className="flex-1 flex items-center justify-center p-8 text-slate-500 font-mono text-xs">
                              <span className="animate-pulse">Loading Pipeline Engine...</span>
                            </div>
                          }>
                            <PipelineDashboard
                              project={activeProject}
                              onUpdateFiles={(newFiles) => {
                                const updated = { ...activeProject, files: newFiles };
                                setProjects(prev => prev.map(p => p.id === activeProject.id ? updated : p));
                                authedFetch(`/api/projects/${activeProject.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(updated)
                                });
                              }}
                              onCompile={handleCompile}
                              onDeploy={handleDeploy}
                              isCompiling={isCompiling}
                              isDeploying={isDeploying}
                              theme={theme}
                            />
                          </Suspense>
                        </ErrorBoundary>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Assistant (Copilot refactoring + Security Auditor panel) */}
              <div className={`w-full lg:w-80 flex-shrink-0 flex-col min-h-0 ${
                activeWorkspaceSubTab === 'assistant' ? 'flex' : 'hidden lg:flex'
              }`}>
                <ErrorBoundary fallbackTitle="AI Assistant Error">
                  <RightAssistant
                    auditResult={activeProject.audit}
                    files={activeProject.files}
                    onApplyAIFix={handleApplyAIFix}
                    onEditContract={handleEditContract}
                    isProcessing={isProcessing}
                    activeProvider={activeProvider}
                    setActiveProvider={setActiveProvider}
                    activeModel={activeModel}
                    setActiveModel={setActiveModel}
                  />
                </ErrorBoundary>
              </div>

            </div>
          </div>
        ) : (
          /* Empty Workspace Splash Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 shadow-xl animate-bounce overflow-hidden">
              <img src={logo} alt="AI Contracts Logo" className="w-10 h-10 object-contain" />
            </div>
            <div className="space-y-1.5 max-w-md">
              <h2 className="text-lg font-bold uppercase tracking-wider">SmartContract.ai Studio</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Design, generate, audit, compile, and deploy enterprise smart contracts using natural language. 
                Supports Solidity, Rust, Move, Tact, Vyper, and Seahorse.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-colors"
              >
                Create Workspace Project
              </button>
              <button
                onClick={() => setShowTemplateLibrary(true)}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-colors"
              >
                <Library className="w-4 h-4" /> Template Library
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New Project Selector Modal */}
      {showNewProjectModal && (
        <BlockchainSelector
          onClose={() => setShowNewProjectModal(false)}
          onCreateProject={handleCreateNewProject}
          isGenerating={isProcessing}
          initialData={pendingConfig}
        />
      )}

      {/* Interactive Template Library Modal */}
      {showTemplateLibrary && (
        <Suspense fallback={null}>
          <TemplateLibrary
            onClose={() => setShowTemplateLibrary(false)}
            onCloneTemplate={handleCloneTemplate}
            activeProject={activeProject}
            theme={theme}
          />
        </Suspense>
      )}

      {/* 11-step Pre-generation Implementation Plan Modal */}
      {activePlan && (
        <ImplementationPlanView
          plan={activePlan}
          onCancel={() => {
            setActivePlan(null);
            setPendingConfig(null);
          }}
          onApprove={(approvedPlan) => handleApproveAndGeneratePlan(approvedPlan, null)}
        />
      )}

      {/* Premium Multi-stage Generation Loader & Error Console */}
      <GenerationLoader
        isOpen={isGeneratingLoaderOpen}
        type={loaderType}
        error={generationError}
        blockchain={pendingConfig?.blockchain}
        language={pendingConfig?.language}
        contractType={pendingConfig?.contractType}
        onCloseError={() => {
          setIsGeneratingLoaderOpen(false);
          setGenerationError(null);
          setShowNewProjectModal(true); // Re-open configuration modal preserving prompt!
        }}
        onRetry={() => {
          if (loaderType === 'planning') {
            if (pendingConfig) handleCreateNewProject(pendingConfig);
          } else {
            if (activePlan) handleApproveAndGeneratePlan(activePlan, pendingConfig);
          }
        }}
      />

      {/* Orchestrator Settings Modal */}
      {showSettingsModal && user && (
        <SettingsModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          currentUser={{
            uid: user.uid,
            email: user.email,
            displayName: (user as any).displayName || user.fullName || '',
            photoURL: user.photoURL || '',
          }}
          theme={theme}
          onSettingsSaved={(prov, mod) => {
            setActiveProvider(prov);
            setActiveModel(mod);
          }}
        />
      )}

      {/* Toast Notifications Overlay */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9, transition: { duration: 0.15 } }}
            className={`fixed bottom-5 right-5 z-[200] max-w-sm p-4 rounded-xl shadow-2xl border flex items-center gap-3 transition-colors duration-250 ${
              theme === 'dark' 
                ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-black/80' 
                : 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/80'
            }`}
          >
            {toast.type === 'success' && (
              <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg shrink-0">
                <Layers className="w-4 h-4" />
              </div>
            )}
            {toast.type === 'error' && (
              <div className="p-1.5 bg-rose-500/10 text-rose-500 rounded-lg shrink-0">
                <AlertCircle className="w-4 h-4" />
              </div>
            )}
            {toast.type === 'info' && (
              <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1 text-xs font-semibold leading-normal text-slate-700 dark:text-slate-300">
              {toast.message}
            </div>
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
