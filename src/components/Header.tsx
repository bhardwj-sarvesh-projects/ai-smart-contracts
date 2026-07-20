import React, { useState } from 'react';
import { 
  Layers, ShieldCheck, Download, Plus, RefreshCw, FolderOpen, 
  ChevronDown, Check, Library, History, Sun, Moon, Home, 
  Code2, Shield, Sliders, Menu, X, LogOut, Settings2, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../types';

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
  activeTab: 'dashboard' | 'workspace' | 'auditing' | 'admin';
  onChangeTab: (tab: 'dashboard' | 'workspace' | 'auditing' | 'admin') => void;
  currentUser: any;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email?.toLowerCase() === 'sarveshtiwarisarvesh@gmail.com';

  const navItems = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'workspace', name: 'Workspace', icon: Code2 },
    { id: 'auditing', name: 'Auditing Hub', icon: Shield },
    ...(isAdmin ? [{ id: 'admin', name: 'Admin Panel', icon: ShieldAlert }] : [])
  ] as const;

  return (
    <>
      {/* Sticky, Glassmorphic Navbar Header */}
      <header className={`sticky top-0 z-40 w-full h-16 border-b flex items-center justify-between px-4 md:px-6 backdrop-blur-md select-none transition-all duration-300 ${
        theme === 'dark' 
          ? 'border-slate-800/80 bg-slate-950/90 text-slate-200 shadow-sm shadow-slate-950/20' 
          : 'border-slate-200/80 bg-white/90 text-slate-750 shadow-sm shadow-slate-100/50'
      }`}>
        
        {/* Left Side: Brand Logo & Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 shadow-lg shadow-indigo-500/10 hover:scale-105 transition-transform duration-200">
            <Layers className="w-5.5 h-5.5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className={`font-sans font-extrabold text-sm md:text-base tracking-tight leading-none ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
              AI Contracts
            </span>
            <span className={`text-[10px] font-mono tracking-wider font-semibold uppercase mt-0.5 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              by BlockOnMate
            </span>
          </div>
        </div>

        {/* Central Nav Tabs - Hidden on Mobile/Tablet */}
        <nav className={`hidden md:flex items-center gap-1.5 p-1 rounded-xl border ${
          theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-100 border-slate-200/70'
        }`}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeTab(item.id as 'dashboard' | 'workspace' | 'auditing' | 'admin')}
                id={`nav-${item.id}`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-250 cursor-pointer ${
                  isActive
                    ? theme === 'dark'
                      ? 'bg-slate-800 text-cyan-400 border border-slate-700/50 shadow-sm'
                      : 'bg-white text-slate-900 border border-slate-200/50 shadow-sm'
                    : theme === 'dark'
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.name}
              </button>
            );
          })}
        </nav>

        {/* Right Side Tools - Desktop Controls */}
        <div className="hidden lg:flex items-center gap-2">
          
          {/* Workspace Active Project Selector */}
          {activeProject ? (
            <div className="relative">
              <button
                onClick={() => setShowProjectsDropdown(!showProjectsDropdown)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  theme === 'dark'
                    ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-900 text-slate-300 hover:border-slate-700'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700'
                }`}
                id="btn-projects-dropdown"
              >
                <FolderOpen className="w-3.5 h-3.5 text-cyan-500" />
                <span className="max-w-[120px] truncate">{activeProject.name}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${showProjectsDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showProjectsDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute left-0 mt-2 w-60 rounded-xl border shadow-xl z-50 py-1.5 ${
                      theme === 'dark' ? 'border-slate-800 bg-slate-950/95 backdrop-blur-md' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="px-3.5 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">Select Project Workspace</p>
                    <div className="max-h-48 overflow-y-auto mt-1">
                      {projects.map((p) => {
                        const isActive = p.id === activeProject.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              onSelectProject(p.id);
                              setShowProjectsDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                              isActive
                                ? theme === 'dark'
                                  ? 'bg-slate-900 text-cyan-400 font-bold'
                                  : 'bg-cyan-50/50 text-cyan-600 font-bold'
                                : theme === 'dark'
                                ? 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                            }`}
                          >
                            <span className="truncate">{p.name}</span>
                            {isActive && <Check className="w-3.5 h-3.5 text-cyan-500" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className={`border-t mt-1.5 pt-1.5 px-1.5 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-100'}`}>
                      <button
                        onClick={() => {
                          onNewProjectClick();
                          setShowProjectsDropdown(false);
                        }}
                        className="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-left text-xs text-cyan-500 hover:bg-cyan-500/10 font-bold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Project Workspace
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <button
              onClick={onNewProjectClick}
              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Project
            </button>
          )}

          {/* Quick Stats: Network badge */}
          {activeProject && (
            <div className="flex items-center gap-1.5">
              <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold tracking-wider uppercase ${
                theme === 'dark' ? 'bg-slate-900/30 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
              }`}>
                ⛓️ {activeProject.blockchain}
              </span>
            </div>
          )}

          {/* Utilities Button Group */}
          {activeProject && (
            <div className={`flex items-center gap-1 border-l pl-2 ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
              {/* Template Library */}
              <button
                onClick={onToggleTemplateLibrary}
                className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                  theme === 'dark' 
                    ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-cyan-400 hover:border-slate-700' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-cyan-600 hover:bg-slate-100/60'
                }`}
                title="Template Library (ERC20, NFTs, DAOs...)"
              >
                <Library className="w-4 h-4" />
              </button>

              {/* Version History */}
              <button
                onClick={onToggleVersionHistory}
                className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                  theme === 'dark' 
                    ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-cyan-400 hover:border-slate-700' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-cyan-600 hover:bg-slate-100/60'
                }`}
                title="Version History & Audit Logs"
              >
                <History className="w-4 h-4" />
              </button>

              {/* Theme Mode Toggle */}
              <button
                onClick={onToggleTheme}
                className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
                  theme === 'dark' 
                    ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-cyan-400 hover:border-slate-700' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-cyan-600 hover:bg-slate-100/60'
                }`}
                title="Toggle Light/Dark Theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Audit Codebase Action */}
              <button
                onClick={onAuditCodebase}
                disabled={isProcessing}
                className={`flex items-center gap-1.5 border text-xs font-bold transition-all duration-200 px-3.5 py-1.5 rounded-lg ml-1 cursor-pointer disabled:opacity-50 ${
                  theme === 'dark'
                    ? 'border-slate-800 bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-900 hover:border-slate-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Perform dynamic security audit"
              >
                {isProcessing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                )}
                Audit Codebase
              </button>

              {/* Export ZIP */}
              <button
                onClick={onExportZIP}
                className="flex items-center gap-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-md shadow-cyan-900/10 transition-all cursor-pointer ml-1"
                title="Download full project workspace as ZIP"
              >
                <Download className="w-3.5 h-3.5" />
                Export ZIP
              </button>
            </div>
          )}

          {/* AI Provider Indicator */}
          <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold tracking-wide uppercase transition-all ${
            theme === 'dark' ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-600'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
            {activeProvider}
          </span>

          {/* System Settings trigger */}
          <button
            onClick={onOpenSettings}
            className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
              theme === 'dark' ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-cyan-400 hover:border-slate-700' : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-cyan-600 hover:bg-slate-100/60'
            }`}
            title="Settings"
          >
            <Sliders className="w-4 h-4" />
          </button>

          {/* Profile & Logout */}
          <div className={`flex items-center gap-2 pl-3 ml-1 border-l ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt="Profile" 
                className="w-7 h-7 rounded-full border border-slate-700/50 object-cover shrink-0 shadow-sm" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700/50 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0 shadow-sm">
                {(currentUser?.displayName || currentUser?.fullName || 'U')[0]?.toUpperCase()}
              </div>
            )}
            <button
              onClick={onLogout}
              className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 hover:text-rose-500 transition-colors cursor-pointer"
              title="Logout session"
            >
              Logout
            </button>
          </div>

        </div>

        {/* Mobile controls & Hamburger trigger */}
        <div className="lg:hidden flex items-center gap-2">
          {/* Quick theme switcher for quick access */}
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              theme === 'dark' ? 'border-slate-800 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              theme === 'dark' ? 'border-slate-800 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </header>

      {/* Mobile Drawer Slideout Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={`lg:hidden border-b overflow-hidden shadow-xl z-30 w-full transition-all duration-300 ${
              theme === 'dark' ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200'
            }`}
          >
            <div className="p-4 space-y-4">
              {/* Navigation Links */}
              <div className="grid grid-cols-3 gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onChangeTab(item.id as 'dashboard' | 'workspace' | 'auditing' | 'admin');
                        setMobileMenuOpen(false);
                      }}
                      className={`py-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all border ${
                        isActive
                          ? theme === 'dark'
                            ? 'bg-slate-900 text-cyan-400 border-cyan-500/30 shadow-inner'
                            : 'bg-cyan-50 text-cyan-600 border-cyan-200'
                          : theme === 'dark'
                          ? 'border-slate-900 text-slate-400 hover:bg-slate-900/40'
                          : 'border-slate-100 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {item.name}
                    </button>
                  );
                })}
              </div>

              {/* Active project dropdown selection for mobile */}
              {activeProject && (
                <div className={`p-3.5 rounded-xl border space-y-2 ${theme === 'dark' ? 'bg-slate-900/40 border-slate-850' : 'bg-slate-50 border-slate-150'}`}>
                  <label className="text-[10px] uppercase font-extrabold text-slate-500 tracking-wider flex items-center gap-1">
                    <FolderOpen className="w-3 h-3 text-cyan-500" /> Active Workspace Project
                  </label>
                  <select
                    value={activeProject.id}
                    onChange={(e) => {
                      onSelectProject(e.target.value);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-xs p-2.5 rounded-lg border focus:outline-none focus:ring-1 focus:ring-cyan-500 ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Action Buttons list */}
              {activeProject && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onToggleTemplateLibrary();
                      setMobileMenuOpen(false);
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                      theme === 'dark' ? 'border-slate-800 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Library className="w-4 h-4 text-cyan-500" />
                    Templates
                  </button>

                  <button
                    onClick={() => {
                      onToggleVersionHistory();
                      setMobileMenuOpen(false);
                    }}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
                      theme === 'dark' ? 'border-slate-800 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <History className="w-4 h-4 text-cyan-500" />
                    Versions
                  </button>

                  <button
                    onClick={() => {
                      onAuditCodebase();
                      setMobileMenuOpen(false);
                    }}
                    disabled={isProcessing}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 ${
                      theme === 'dark' ? 'border-slate-800 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Audit Code
                  </button>

                  <button
                    onClick={() => {
                      onExportZIP();
                      setMobileMenuOpen(false);
                    }}
                    className="py-2 px-3 rounded-lg bg-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export ZIP
                  </button>
                </div>
              )}

              {/* Advanced settings, provider badge and profile logout at the bottom */}
              <div className={`pt-4 border-t flex flex-col gap-3 ${theme === 'dark' ? 'border-slate-850' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">AI Orchestrator:</span>
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${theme === 'dark' ? 'bg-slate-900 text-indigo-300' : 'bg-slate-100 text-indigo-600'}`}>
                    {activeProvider}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      onOpenSettings();
                      setMobileMenuOpen(false);
                    }}
                    className={`flex-1 py-2 px-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                      theme === 'dark' ? 'border-slate-800 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Settings
                  </button>

                  <button
                    onClick={() => {
                      onLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="flex-1 py-2 px-3 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
