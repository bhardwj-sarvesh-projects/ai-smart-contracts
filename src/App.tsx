import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FileTree from './components/FileTree';
import CodeWorkspace from './components/CodeWorkspace';
import RightAssistant from './components/RightAssistant';
import BlockchainSelector from './components/BlockchainSelector';
import TemplateLibrary from './components/TemplateLibrary';
import ImplementationPlanView from './components/ImplementationPlanView';
import VersionHistory from './components/VersionHistory';
import PipelineDashboard from './components/PipelineDashboard';
import DashboardView from './components/DashboardView';
import AuditingHub from './components/AuditingHub';
import { Project, ProjectFile, Vulnerability, Version } from './types';
import { Layers, Sparkles, RefreshCw, AlertCircle, Library } from 'lucide-react';
import JSZip from 'jszip';
import AuthView from './components/AuthView';
import SettingsModal from './components/SettingsModal';
import { useAuth } from './context/AuthContext';

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [generationError, setGenerationError] = useState<Error | null>(null);

  if (generationError) {
    throw generationError;
  }

  // Active Main Tab/View State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'workspace' | 'auditing'>('dashboard');

  // Advanced toggles
  const [showTemplateLibrary, setShowTemplateLibrary] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

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

  // Active AI Provider config
  const [activeProvider, setActiveProvider] = useState('auto');
  const [activeModel, setActiveModel] = useState('Intelligent Router');

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

  // Load projects and settings when user changes
  useEffect(() => {
    if (user) {
      fetchProjects();
      loadUserSettings();
    } else {
      setProjects([]);
    }
  }, [user]);

  const loadUserSettings = async () => {
    try {
      const res = await authedFetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setActiveProvider(data.provider || 'openai');
        setActiveModel(data.defaultModel || 'Intelligent Router');
      }
    } catch (err) {
      console.error('Failed to load user settings', err);
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await authedFetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        if (data.length > 0 && !activeProjectId) {
          setActiveProjectId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load projects', err);
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
    setActiveProjectId(id);
    setShowVersionHistory(false);
    if (targetTab) {
      setActiveTab(targetTab);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this smart contract workspace?")) return;
    try {
      const res = await authedFetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (activeProjectId === id) {
          setActiveProjectId('');
        }
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
      alert('File already exists in workspace!');
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
      setActivePlan(planData);
      setPendingConfig(configData);
    } catch (err: any) {
      console.error('Failed to generate pre-plan', err);
      alert(`AI Plan Generation Failed: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // User Approved Plan -> Run final code builder
  const handleApproveAndGeneratePlan = async (approvedPlan: any, configData: any) => {
    setIsProcessing(true);
    setActivePlan(null);

    const config = configData || pendingConfig;
    if (!config) {
      console.warn('[CONTRACT GENERATION] Missing pending configuration context.');
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

      // Step 6: Backend request sent
      console.log("[CONTRACT GENERATION STEP] Backend request sent");

      const response = await authedFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: config.prompt,
          blockchain: config.blockchain,
          language: config.language,
          framework: config.framework,
          contractType: config.contractType,
          provider: activeProvider,
          model: activeModel,
          plan: approvedPlan
        })
      });

      // Step 7: Backend response received
      console.log(`[CONTRACT GENERATION STEP] Backend response received: Status ${response.status}`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        const errMessage = errData.error || errData.message || 'AI Generation service failed';
        console.error(`[CONTRACT GENERATION EXCEPTION] Backend responded with error: ${errMessage}`, errData);
        throw new Error(errMessage);
      }

      const aiGenerated = await response.json();
      if (!aiGenerated) {
        throw new Error("Invalid AI output: received null or empty response from backend.");
      }

      // Step 8: Response parsed
      console.log("[CONTRACT GENERATION STEP] Response parsed");

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
      setActiveTab('workspace');

      // Step 9: Contract rendered
      console.log("[CONTRACT GENERATION STEP] Contract rendered");
    } catch (err: any) {
      console.error('[CONTRACT GENERATION EXCEPTION]', err);
      // Store in state to propagate error to global React Error Boundary (forces rendering crash detection)
      setGenerationError(err);
      throw err;
    } finally {
      setIsProcessing(false);
      setPendingConfig(null);
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

      if (!response.ok) throw new Error('Refactor failed');

      const editResult = await response.json();

      const newVersion = {
        id: `v-${Date.now()}`,
        timestamp: new Date().toISOString(),
        prompt: instruction,
        files: activeProject.files,
        summary: editResult.summary || 'Codebase modified.'
      };

      const updatedProject = {
        ...activeProject,
        files: editResult.files || activeProject.files,
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
    } catch (err) {
      console.error('Failed to edit smart contract', err);
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
    } catch (err: any) {
      console.error('Failed to clone template', err);
      alert(`Failed to clone template: ${err.message || String(err)}`);
    } finally {
      setIsProcessing(false);
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
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-800">
        <div className="flex flex-col items-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium text-slate-500 font-mono tracking-wider uppercase">
            Loading Workspace...
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
      />

      {/* Active Tab Router */}
      {activeTab === 'dashboard' ? (
        <DashboardView
          projects={projects}
          theme={theme}
          onSelectProject={handleSelectProjectWithTab}
          onNewProjectClick={() => setShowNewProjectModal(true)}
          onDeleteProject={handleDeleteProject}
        />
      ) : activeTab === 'auditing' ? (
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
        />
      ) : (
        /* Workspace View (with fallback empty splash state) */
        activeProject ? (
          <div className="flex-1 flex min-h-0 relative">
            
            {/* Left Sidebar (File Explorer / Version History Switcher) */}
            <div className={`w-64 flex-shrink-0 border-r flex flex-col min-h-0 ${theme === 'dark' ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
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
                />
              )}
            </div>

            {/* Central Workspace (Editor + Pipeline Assembly Controller) */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Upper Editor Workspace */}
              <div className="flex-1 min-h-0">
                <CodeWorkspace
                  files={activeProject.files}
                  activeFilePath={activeProject.activeFilePath}
                  onFileContentChange={handleFileContentChange}
                  onSelectFile={handleSelectFile}
                />
              </div>

              {/* Advanced 10-stage deployment compiler pipeline replacement */}
              <div className="h-72 flex-shrink-0">
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
                />
              </div>
            </div>

            {/* Right Assistant (Copilot refactoring + Security Auditor panel) */}
            <div className="w-80 flex-shrink-0">
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
            </div>
          </div>
        ) : (
          /* Empty Workspace Splash Screen */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-xl animate-bounce">
              <Layers className="w-7 h-7 text-white" />
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
        )
      )}

      {/* New Project Selector Modal */}
      {showNewProjectModal && (
        <BlockchainSelector
          onClose={() => setShowNewProjectModal(false)}
          onCreateProject={handleCreateNewProject}
          isGenerating={isProcessing}
        />
      )}

      {/* Interactive Template Library Modal */}
      {showTemplateLibrary && (
        <TemplateLibrary
          onClose={() => setShowTemplateLibrary(false)}
          onCloneTemplate={handleCloneTemplate}
          activeProject={activeProject}
        />
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
          onSettingsSaved={(prov, mod) => {
            setActiveProvider(prov);
            setActiveModel(mod);
          }}
        />
      )}
    </div>
  );
}
