import React, { useState } from 'react';
import { Layers, ShieldCheck, Download, Plus, RefreshCw, FolderOpen, ChevronDown, Check, Library, History, Sun, Moon, Home, Code2, Shield, Sliders } from 'lucide-react';
import { Project } from '../types';
import { AppUser } from '../lib/firebase';

interface HeaderProps {
  projects: Project[];
  activeProject?: Project;
  onSelectProject: (id: string) => void;
  onNewProjectClick: () => void;
  onExportZIP: () => void;
  onAuditCodebase: () => void;
  isProcessing: boolean;
  onToggleTemplateLibrary: () => void;
  onToggleVersionHistory: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  activeTab: 'dashboard' | 'workspace' | 'auditing';
  onChangeTab: (tab: 'dashboard' | 'workspace' | 'auditing') => void;
  currentUser: AppUser;
  activeProvider: string;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export default function Header({
  projects,
  activeProject,
  onSelectProject,
  onNewProjectClick,
  onExportZIP,
  onAuditCodebase,
  isProcessing,
  onToggleTemplateLibrary,
  onToggleVersionHistory,
  theme,
  onToggleTheme,
  activeTab,
  onChangeTab,
  currentUser,
  activeProvider,
  onOpenSettings,
  onLogout
}: HeaderProps) {
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);

  return (
    <header className={`flex h-14 items-center justify-between border-b px-4 select-none transition-colors ${
      theme === 'dark' ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-200 bg-white text-slate-700'
    }`}>
      {/* Branding & Logo */}
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-md">
          <Layers className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className={`font-sans font-bold text-sm tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>SmartContract.ai Studio</span>
          <span className={`text-[10px] font-mono tracking-wider uppercase ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>SaaS Copilot v2.0</span>
        </div>
      </div>

      {/* Central Navigation Tabs */}
      <div className={`flex items-center gap-1 p-1 rounded-lg border ${
        theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-100 border-slate-200'
      }`}>
        <button
          onClick={() => onChangeTab('dashboard')}
          id="nav-dashboard"
          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'dashboard'
              ? theme === 'dark'
                ? 'bg-slate-850 text-cyan-400 border border-slate-700/60 shadow-inner'
                : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          Dashboard
        </button>
        <button
          onClick={() => onChangeTab('workspace')}
          id="nav-workspace"
          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'workspace'
              ? theme === 'dark'
                ? 'bg-slate-850 text-cyan-400 border border-slate-700/60 shadow-inner'
                : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          Workspace
        </button>
        <button
          onClick={() => onChangeTab('auditing')}
          id="nav-auditing"
          className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
            activeTab === 'auditing'
              ? theme === 'dark'
                ? 'bg-slate-850 text-cyan-400 border border-slate-700/60 shadow-inner'
                : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-3.5 h-3.5" />
          Auditing Hub
        </button>
      </div>

      {/* Active Project Selector dropdown */}
      <div className="flex items-center gap-3">
        {activeProject ? (
          <div className="relative">
            <button
              onClick={() => setShowProjectsDropdown(!showProjectsDropdown)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-semibold transition-colors ${
                theme === 'dark'
                  ? 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-300'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
              }`}
              id="btn-projects-dropdown"
            >
              <FolderOpen className="w-3.5 h-3.5 text-cyan-500" />
              <span className="max-w-[150px] truncate">{activeProject.name}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showProjectsDropdown && (
              <div className={`absolute left-0 mt-1.5 w-60 rounded-md border shadow-lg z-50 py-1 ${
                theme === 'dark' ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
              }`}>
                <p className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Workspace Project</p>
                <div className="max-h-48 overflow-y-auto">
                  {projects.map((p) => {
                    const isActive = p.id === activeProject.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p.id);
                          setShowProjectsDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                          isActive
                            ? 'bg-slate-900/10 text-cyan-600 font-medium'
                            : theme === 'dark'
                            ? 'text-slate-400 hover:bg-slate-900/40 hover:text-slate-200'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                      </button>
                    );
                  })}
                </div>
                <div className={`border-t mt-1 pt-1 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                  <button
                    onClick={() => {
                      onNewProjectClick();
                      setShowProjectsDropdown(false);
                    }}
                    className="w-full flex items-center gap-1.5 px-3 py-2 text-left text-xs text-cyan-500 hover:bg-slate-900/10 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    New Project Workspace
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={onNewProjectClick}
            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Workspace Project
          </button>
        )}

        {/* Network & Language indicator badges */}
        {activeProject && (
          <div className="hidden md:flex items-center gap-2">
            <span className={`border px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              ⛓️ {activeProject.blockchain}
            </span>
            <span className={`border px-2 py-1 rounded text-[10px] font-semibold uppercase tracking-wider ${
              theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              📝 {activeProject.language}
            </span>
          </div>
        )}
      </div>

      {/* Action utilities */}
      <div className="flex items-center gap-2">
        {activeProject && (
          <>
            {/* Template Library Tab Trigger */}
            <button
              onClick={onToggleTemplateLibrary}
              className={`p-1.5 rounded border transition-colors hover:text-cyan-400 ${
                theme === 'dark' ? 'border-slate-800 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
              title="Open Smart Contract Template Library (ERC20, NFTs, DAO, DEXs...)"
            >
              <Library className="w-4 h-4" />
            </button>

            {/* Version History Tab Trigger */}
            <button
              onClick={onToggleVersionHistory}
              className={`p-1.5 rounded border transition-colors hover:text-cyan-400 ${
                theme === 'dark' ? 'border-slate-800 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
              title="Project History, Audit Reports & Version Comparison Tool"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Light/Dark mode switcher */}
            <button
              onClick={onToggleTheme}
              className={`p-1.5 rounded border transition-colors hover:text-cyan-400 ${
                theme === 'dark' ? 'border-slate-800 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
              title="Toggle Application Visual Theme Mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={onAuditCodebase}
              disabled={isProcessing}
              className={`flex items-center gap-1.5 border text-xs font-semibold transition-colors disabled:opacity-50 px-3 py-1.5 rounded-md ${
                theme === 'dark'
                  ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-300'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600'
              }`}
              id="btn-audit-top"
              title="Perform dynamic security audit via OpenAI"
            >
              {isProcessing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              )}
              Audit Codebase
            </button>

            <button
              onClick={onExportZIP}
              className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm transition-all"
              id="btn-export-zip"
              title="Download full project workspace as ZIP"
            >
              <Download className="w-3.5 h-3.5" />
              Export ZIP
            </button>
          </>
        )}

        {/* Dynamic AI Provider Status Badge */}
        <span className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold tracking-wide uppercase ${
          theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
          AI: {activeProvider}
        </span>

        {/* Orchestrator Settings Trigger */}
        <button
          onClick={onOpenSettings}
          className={`p-1.5 rounded border transition-colors hover:text-cyan-400 ${
            theme === 'dark' ? 'border-slate-800 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
          }`}
          title="AI Orchestrator settings"
        >
          <Sliders className="w-4 h-4" />
        </button>

        {/* User Session Profile & Secure Logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800/80">
          {currentUser?.photoURL ? (
            <img 
              src={currentUser.photoURL} 
              alt={currentUser.displayName} 
              className="w-6 h-6 rounded-full border border-slate-700/80 object-cover shrink-0" 
              referrerPolicy="no-referrer" 
            />
          ) : (
            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700/80 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
              {currentUser?.displayName?.[0]?.toUpperCase() || 'U'}
            </div>
          )}
          <button
            onClick={onLogout}
            className="text-[10px] uppercase font-bold text-slate-500 hover:text-rose-400 transition"
            title="Secure logout session"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
