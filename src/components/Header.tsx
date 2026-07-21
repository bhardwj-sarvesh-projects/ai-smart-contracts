import React, { useState } from 'react';
import { 
  Layers, ShieldCheck, Download, Plus, RefreshCw, FolderOpen, 
  ChevronDown, Check, Library, History, Sun, Moon, Home, 
  Code2, Shield, Sliders, Menu, X, LogOut, Settings2, ShieldAlert,
  Bell, Info, CheckCircle2, AlertTriangle, Zap, Cpu, User
} from 'lucide-react';
import logo from '../assets/logo.jpg';
import { motion, AnimatePresence } from 'motion/react';
import { Project } from '../types';
import { BLOCKCHAINS } from '../data/templates';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  projects: Project[];
  activeProject?: Project;
  onSelectProject: (id: string) => void;
  onUpdateProjectSettings?: (id: string, updates: Partial<Project>) => void;
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
  onUpdateProjectSettings,
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
  const { updateProfileName, changePassword } = useAuth();
  
  const [showProjectsDropdown, setShowProjectsDropdown] = useState(false);
  const [showChainDropdown, setShowChainDropdown] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  // Profile-specific states
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showChangeUsernameModal, setShowChangeUsernameModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  
  const [newUsernameInput, setNewUsernameInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);

  const getDisplayName = () => {
    return currentUser?.fullName || currentUser?.displayName || currentUser?.username || 'User';
  };

  const renderProfessionalAvatar = (uid: string, name: string) => {
    const seed = uid ? uid.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    const palettes = [
      { bg: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300', fill: '#0284c7' },
      { bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300', fill: '#059669' },
      { bg: 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300', fill: '#7c3aed' },
      { bg: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300', fill: '#e11d48' },
      { bg: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300', fill: '#d97706' },
      { bg: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300', fill: '#4f46e5' },
      { bg: 'bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300', fill: '#0d9488' }
    ];
    const palette = palettes[seed % palettes.length];
    const initial = (name || 'U')[0].toUpperCase();
    
    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-inner overflow-hidden relative shrink-0 ${palette.bg}`}>
        <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 100 100">
          <circle cx="20" cy="20" r="30" fill={palette.fill} />
          <circle cx="80" cy="80" r="25" fill={palette.fill} />
        </svg>
        <span className="relative z-10">{initial}</span>
      </div>
    );
  };

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsernameInput.trim()) return;
    setErrorMsg('');
    setSuccessMsg('');
    setLoadingAction(true);
    try {
      await updateProfileName(newUsernameInput.trim());
      setSuccessMsg('Username updated successfully!');
      setTimeout(() => {
        setShowChangeUsernameModal(false);
        setNewUsernameInput('');
        setSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update username.');
    } finally {
      setLoadingAction(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPasswordInput !== confirmPasswordInput) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (newPasswordInput.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setLoadingAction(true);
    try {
      await changePassword(newPasswordInput);
      setSuccessMsg('Password changed successfully!');
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setNewPasswordInput('');
        setConfirmPasswordInput('');
        setSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to change password.');
    } finally {
      setLoadingAction(false);
    }
  };

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email?.toLowerCase() === 'sarveshtiwarisarvesh@gmail.com';
  const isDark = theme === 'dark';

  // Mock SaaS Notification logs
  const notifications = [
    { id: 1, type: 'success', text: 'Solidity Compiler initialized successfully', time: 'Just now' },
    { id: 2, type: 'info', text: 'Connected to blockonmate sandbox network node', time: '5m ago' },
    { id: 3, type: 'warning', text: 'Audit Scan: 0 vulnerabilities found in recent compilation', time: '12m ago' },
    { id: 4, type: 'success', text: 'Welcome back! Theme initialized in light canvas mode', time: '20m ago' },
  ];

  // Primary Nav links matching SaaS standard layout
  const primaryNavItems = [
    { id: 'dashboard', name: 'Dashboard', icon: Home, action: () => onChangeTab('dashboard') },
    { id: 'workspace', name: 'Projects', icon: Code2, action: () => onChangeTab('workspace') },
    { id: 'templates', name: 'Templates', icon: Library, action: onToggleTemplateLibrary },
    { id: 'auditing', name: 'Audit', icon: Shield, action: () => onChangeTab('auditing') },
    { id: 'deploy', name: 'Deploy', icon: Zap, action: () => onChangeTab('workspace') },
    { id: 'settings', name: 'Settings', icon: Sliders, action: onOpenSettings },
  ];

  // Find configuration for active project blockchain
  const activeChainId = activeProject?.blockchain?.toLowerCase() || '';
  const currentChainConfig = BLOCKCHAINS.find(b => b.id === activeChainId || b.name.toLowerCase() === activeChainId);
  const currentBlockchainName = currentChainConfig?.name || activeProject?.blockchain || 'Ethereum';

  // Get current language configuration
  const activeLangId = activeProject?.language?.toLowerCase() || '';
  const currentLangConfig = currentChainConfig?.languages.find(l => l.id === activeLangId || l.name.toLowerCase() === activeLangId);
  const currentLanguageName = currentLangConfig?.name || activeProject?.language || 'Solidity';
  const currentFrameworkName = activeProject?.framework || 'Hardhat';

  const handleSelectBlockchain = (chainId: string) => {
    if (onUpdateProjectSettings && activeProject) {
      const config = BLOCKCHAINS.find(b => b.id === chainId);
      if (config) {
        const defaultLang = config.languages[0];
        const defaultFramework = defaultLang.frameworks[0] || 'Default';
        onUpdateProjectSettings(activeProject.id, {
          blockchain: config.id,
          language: defaultLang.id,
          framework: defaultFramework
        });
      }
      setShowChainDropdown(false);
    }
  };

  const handleSelectLanguage = (langId: string) => {
    if (onUpdateProjectSettings && activeProject && currentChainConfig) {
      const langConfig = currentChainConfig.languages.find(l => l.id === langId);
      if (langConfig) {
        onUpdateProjectSettings(activeProject.id, {
          language: langId,
          framework: langConfig.frameworks[0] || 'Default'
        });
      }
      setShowLanguageDropdown(false);
    }
  };

  return (
    <>
      {/* 1. PRIMARY NAVBAR */}
      <header className={`sticky top-0 z-40 w-full h-16 border-b flex items-center justify-between px-4 md:px-6 select-none transition-all duration-300 ${
        isDark 
          ? 'border-slate-850 bg-slate-950 text-slate-200 shadow-lg shadow-slate-950/40' 
          : 'border-slate-200 bg-white text-slate-800 shadow-sm shadow-slate-100/50'
      }`}>
        
        {/* Left Brand Area */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 border border-blue-200/50 shadow-md overflow-hidden shrink-0">
            <img src={logo} alt="AI Contracts Logo" className="w-7 h-7 object-contain" referrerPolicy="no-referrer" />
          </div>
          <div className="flex flex-col">
            <span className={`font-sans font-extrabold text-sm md:text-base tracking-tight leading-none ${isDark ? 'text-white' : 'text-slate-900'}`}>
              AI Contracts
            </span>
            <span className={`text-[10px] font-mono tracking-wider font-semibold uppercase mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              by BlockOnMate
            </span>
          </div>
        </div>

        {/* Central Nav Links */}
        <nav className="hidden md:flex items-center gap-1">
          {primaryNavItems.map((item) => {
            const Icon = item.icon;
            const isTabActive = activeTab === item.id || (item.id === 'workspace' && activeTab === 'workspace') || (item.id === 'deploy' && activeTab === 'workspace');
            return (
              <button
                key={item.id}
                onClick={item.action}
                id={`primary-nav-${item.id}`}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                  isTabActive
                    ? isDark
                      ? 'bg-slate-900 text-cyan-400 font-bold border border-slate-800'
                      : 'bg-blue-50/80 text-blue-600 font-bold border border-blue-100'
                    : isDark
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {item.name}
              </button>
            );
          })}
          {isAdmin && (
            <button
              onClick={() => onChangeTab('admin')}
              id="primary-nav-admin"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 cursor-pointer ${
                activeTab === 'admin'
                  ? isDark
                    ? 'bg-slate-900 text-rose-400 font-bold border border-slate-800'
                    : 'bg-rose-50 text-rose-600 font-bold border border-rose-100'
                  : isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Admin
            </button>
          )}
        </nav>

        {/* Right Section Tools */}
        <div className="hidden md:flex items-center gap-3">
          
          {/* Theme Mode Toggle */}
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer ${
              isDark 
                ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-cyan-400 hover:border-slate-700' 
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-slate-100/60'
            }`}
            title="Toggle Light/Dark Theme"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* SaaS Notifications System */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotificationsDropdown(!showNotificationsDropdown);
                setHasUnreadNotifications(false);
              }}
              className={`p-2 rounded-lg border transition-all duration-200 cursor-pointer relative ${
                isDark 
                  ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-cyan-400 hover:border-slate-700' 
                  : 'border-slate-200 bg-slate-50 text-slate-500 hover:text-blue-600 hover:bg-slate-100/60'
              }`}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {hasUnreadNotifications && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              )}
            </button>

            <AnimatePresence>
              {showNotificationsDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute right-0 mt-2 w-80 rounded-xl border shadow-xl z-50 py-2 ${
                    isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <div className="px-4 py-2 border-b flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wider uppercase text-slate-400">Activity Monitor</span>
                    <button 
                      onClick={() => setShowNotificationsDropdown(false)}
                      className="text-[10px] text-blue-500 hover:underline cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-900">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900/45 transition-colors flex gap-2.5 items-start">
                        {n.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                        {n.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />}
                        {n.type === 'info' && <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />}
                        <div className="flex flex-col gap-0.5">
                          <p className="text-xs font-medium leading-normal text-slate-600 dark:text-slate-300">{n.text}</p>
                          <span className="text-[9px] text-slate-400 font-mono">{n.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* AI Orchestrator Label */}
          <span className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wide uppercase transition-all ${
            isDark ? 'bg-slate-900/50 border-slate-800 text-indigo-300' : 'bg-slate-50 border-slate-200 text-indigo-600'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            {activeProvider}
          </span>

          {/* User Profile Avatar & Dropdown */}
          <div className="relative pl-3 border-l border-slate-200 dark:border-slate-800 shrink-0">
            <button
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity cursor-pointer focus:outline-none"
              id="btn-navbar-profile-avatar"
            >
              {renderProfessionalAvatar(currentUser?.uid || '1', getDisplayName())}
              <div className="hidden sm:flex flex-col items-start leading-none gap-0.5">
                <span className="text-[10px] font-bold truncate max-w-[90px] text-slate-700 dark:text-slate-300">
                  {getDisplayName()}
                </span>
                <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400">
                  {currentUser?.role || 'Developer'}
                </span>
              </div>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-250 ${showProfileDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showProfileDropdown && (
                <>
                  {/* Invisible clickaway handler */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileDropdown(false)} />
                  
                  {/* Dropdown Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className={`absolute right-0 mt-2.5 w-52 rounded-2xl border shadow-2xl z-50 py-1.5 overflow-hidden transition-colors duration-300 ${
                      theme === 'dark' 
                        ? 'bg-slate-950 border-slate-850 text-slate-200' 
                        : 'bg-white border-slate-200 text-slate-800 shadow-slate-200/50'
                    }`}
                  >
                    {/* Header: display name & role */}
                    <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-900 bg-slate-50/50 dark:bg-slate-900/30">
                      <div className="text-xs font-bold truncate">{getDisplayName()}</div>
                      <div className="text-[9px] text-slate-400 font-mono tracking-wide mt-0.5">{currentUser?.email}</div>
                    </div>

                    <div className="p-1.5 space-y-0.5">
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          setShowProfileModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5 text-blue-500" />
                        Profile Settings
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          setShowChangeUsernameModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                      >
                        <Code2 className="w-3.5 h-3.5 text-emerald-500" />
                        Change Username
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          setShowChangePasswordModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                      >
                        <Shield className="w-3.5 h-3.5 text-purple-500" />
                        Change Password
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          onOpenSettings();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                      >
                        <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                        Global Settings
                      </button>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-900 p-1.5">
                      <button
                        onClick={() => {
                          setShowProfileDropdown(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left transition-colors cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        Logout Session
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

        </div>

        {/* Mobile controls & Hamburger trigger */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              isDark ? 'border-slate-800 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'
            }`}
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          {/* Mobile Profile Trigger (direct button access) */}
          <button
            onClick={() => {
              setShowProfileModal(true);
            }}
            className="flex items-center justify-center shrink-0 focus:outline-none cursor-pointer p-0.5 rounded-full border border-slate-200 dark:border-slate-800 hover:opacity-90 transition-opacity"
            id="btn-mobile-avatar-profile"
            title="User Profile"
          >
            {renderProfessionalAvatar(currentUser?.uid || '1', getDisplayName())}
          </button>

          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              isDark ? 'border-slate-800 bg-slate-900/60 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
            }`}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

      </header>

      {/* 2. SECONDARY WORKSPACE TOOLBAR (Sticky below navbar inside project pages) */}
      {activeTab === 'workspace' && activeProject && (
        <div className={`sticky top-16 z-30 w-full h-12 border-b flex items-center justify-between px-4 md:px-6 select-none transition-all duration-300 ${
          isDark 
            ? 'border-slate-900 bg-slate-950/80 backdrop-blur-md text-slate-300 shadow-sm' 
            : 'border-slate-200 bg-slate-50/90 backdrop-blur-md text-slate-700 shadow-sm shadow-slate-100/30'
        }`}>
          
          {/* Left Side: selectors */}
          <div className="flex items-center gap-2 shrink-1 py-1.5 overflow-visible">
            
            {/* Project Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProjectsDropdown(!showProjectsDropdown);
                  setShowChainDropdown(false);
                  setShowLanguageDropdown(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-md border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isDark
                    ? 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-200 hover:border-slate-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
                id="btn-workspace-projects-dropdown"
              >
                <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="max-w-[130px] truncate">{activeProject.name}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showProjectsDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showProjectsDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute left-0 mt-1.5 w-64 rounded-lg border shadow-xl z-50 py-1.5 ${
                      isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Project Workspace</p>
                    <div className="max-h-48 overflow-y-auto mt-1">
                      {projects.map((p) => {
                        const isSelected = p.id === activeProject.id;
                        return (
                          <button
                            key={p.id}
                            onClick={() => {
                              onSelectProject(p.id);
                              setShowProjectsDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? isDark
                                  ? 'bg-slate-900 text-cyan-400 font-bold'
                                  : 'bg-blue-50 text-blue-600 font-bold'
                                : isDark
                                ? 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span className="truncate">{p.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className={`border-t mt-1.5 pt-1.5 px-1.5 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                      <button
                        onClick={() => {
                          onNewProjectClick();
                          setShowProjectsDropdown(false);
                        }}
                        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-left text-xs text-blue-600 hover:bg-blue-50 dark:text-cyan-400 dark:hover:bg-slate-900 font-bold transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        New Project Workspace
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Blockchain Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowChainDropdown(!showChainDropdown);
                  setShowProjectsDropdown(false);
                  setShowLanguageDropdown(false);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-md border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isDark
                    ? 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-200 hover:border-slate-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                }`}
                id="btn-workspace-chains-dropdown"
              >
                <span className="text-xs shrink-0">⛓️</span>
                <span className="capitalize">{currentBlockchainName}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showChainDropdown ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showChainDropdown && (
                  <motion.div 
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute left-0 mt-1.5 w-56 rounded-lg border shadow-xl z-50 py-1.5 ${
                      isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Target Blockchain</p>
                    <div className="max-h-56 overflow-y-auto mt-1">
                      {BLOCKCHAINS.map((b) => {
                        const isSelected = b.id === activeChainId || b.name.toLowerCase() === activeChainId;
                        return (
                          <button
                            key={b.id}
                            onClick={() => handleSelectBlockchain(b.id)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? isDark
                                  ? 'bg-slate-900 text-cyan-400 font-bold'
                                  : 'bg-blue-50 text-blue-600 font-bold'
                                : isDark
                                ? 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span>{b.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Language Selector Dropdown (Optional later / Built beautifully now) */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowLanguageDropdown(!showLanguageDropdown);
                  setShowProjectsDropdown(false);
                  setShowChainDropdown(false);
                }}
                disabled={!currentChainConfig}
                className={`flex items-center gap-1.5 px-2.5 py-1.2 rounded-md border text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  isDark
                    ? 'border-slate-800 bg-slate-900/50 hover:bg-slate-900 text-slate-200 hover:border-slate-700'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                } disabled:opacity-50`}
                id="btn-workspace-lang-dropdown"
              >
                <Cpu className="w-3 h-3 text-emerald-500 shrink-0" />
                <span className="capitalize">{currentLanguageName} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">({currentFrameworkName})</span></span>
                {currentChainConfig && currentChainConfig.languages.length > 1 && (
                  <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${showLanguageDropdown ? 'rotate-180' : ''}`} />
                )}
              </button>

              <AnimatePresence>
                {showLanguageDropdown && currentChainConfig && currentChainConfig.languages.length > 1 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.12 }}
                    className={`absolute left-0 mt-1.5 w-52 rounded-lg border shadow-xl z-50 py-1.5 ${
                      isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <p className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">Select Smart Language</p>
                    <div className="mt-1">
                      {currentChainConfig.languages.map((l) => {
                        const isSelected = l.id === activeLangId || l.name.toLowerCase() === activeLangId;
                        return (
                          <button
                            key={l.id}
                            onClick={() => handleSelectLanguage(l.id)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                              isSelected
                                ? isDark
                                  ? 'bg-slate-900 text-cyan-400 font-bold'
                                  : 'bg-blue-50 text-blue-600 font-bold'
                                : isDark
                                ? 'text-slate-400 hover:bg-slate-900/50 hover:text-slate-200'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            <span>{l.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>

          {/* Right Side: workspace utility actions */}
          <div className="flex items-center gap-1.5 shrink-0 pl-2">
            
            {/* Templates library toggle */}
            <button
              onClick={onToggleTemplateLibrary}
              className={`p-1.8 rounded-md border transition-all duration-200 cursor-pointer ${
                isDark 
                  ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-cyan-400 hover:border-slate-700' 
                  : 'border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:bg-slate-50'
              }`}
              title="Template Library"
            >
              <Library className="w-3.8 h-3.8" />
            </button>

            {/* Version History / Audit Logs toggle */}
            <button
              onClick={onToggleVersionHistory}
              className={`p-1.8 rounded-md border transition-all duration-200 cursor-pointer ${
                isDark 
                  ? 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-cyan-400 hover:border-slate-700' 
                  : 'border-slate-200 bg-white text-slate-600 hover:text-blue-600 hover:bg-slate-50'
              }`}
              title="Version History"
            >
              <History className="w-3.8 h-3.8" />
            </button>

            {/* Audit Codebase trigger */}
            <button
              onClick={onAuditCodebase}
              disabled={isProcessing}
              className={`hidden sm:flex items-center gap-1.2 border text-[11px] font-bold transition-all duration-200 px-2.5 py-1.2 rounded-md cursor-pointer disabled:opacity-50 ${
                isDark
                  ? 'border-slate-800 bg-slate-900/40 text-slate-300 hover:text-white hover:bg-slate-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {isProcessing ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
              )}
              Audit
            </button>

            {/* Export project ZIP button */}
            <button
              onClick={onExportZIP}
              className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 text-white px-2.5 py-1.2 rounded-md text-[11px] font-bold shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3 h-3" />
              Export
            </button>

          </div>

        </div>
      )}

      {/* 3. MOBILE MENU DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className={`lg:hidden border-b overflow-hidden shadow-xl z-35 w-full transition-all duration-300 ${
              isDark ? 'bg-slate-950 border-slate-850' : 'bg-white border-slate-200'
            }`}
          >
            <div className="p-4 space-y-4">
              
              {/* Navigation Links */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Navigation</p>
                <div className="grid grid-cols-3 gap-2">
                  {primaryNavItems.filter(item => item.id !== 'settings').map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          item.action();
                          setMobileMenuOpen(false);
                        }}
                        className={`py-3 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all border ${
                          isActive
                            ? isDark
                              ? 'bg-slate-900 text-cyan-400 border-cyan-500/30 shadow-inner'
                              : 'bg-blue-50 text-blue-600 border-blue-200'
                            : isDark
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
              </div>

              {/* Developer Identity / Profile Details (Mobile Mode) */}
              <div className={`pt-4 border-t ${isDark ? 'border-slate-850' : 'border-slate-100'}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Developer Identity</p>
                
                <div className={`p-3 rounded-xl border flex items-center gap-3 mb-3 ${
                  isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  {renderProfessionalAvatar(currentUser?.uid || '1', getDisplayName())}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{getDisplayName()}</div>
                    <div className="text-[9px] text-slate-400 font-mono truncate mt-0.5">{currentUser?.email}</div>
                    <div className="inline-flex mt-1 text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-500 dark:text-cyan-400 dark:bg-cyan-500/10">
                      {currentUser?.role || 'Developer'}
                    </div>
                  </div>
                </div>

                {/* Profile Settings Actions on Mobile */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowProfileModal(true);
                    }}
                    className={`p-2.5 rounded-lg border text-left font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800' 
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <User className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Profile Info</span>
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowChangeUsernameModal(true);
                    }}
                    className={`p-2.5 rounded-lg border text-left font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800' 
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Code2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Username</span>
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowChangePasswordModal(true);
                    }}
                    className={`p-2.5 rounded-lg border text-left font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800' 
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span>Password</span>
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenSettings();
                    }}
                    className={`p-2.5 rounded-lg border text-left font-bold flex items-center gap-2 transition-colors cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-800' 
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Settings2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span>Global Config</span>
                  </button>
                </div>
              </div>

              {/* Advanced settings and logout on mobile */}
              <div className={`pt-4 border-t flex flex-col gap-3 ${isDark ? 'border-slate-850' : 'border-slate-100'}`}>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>AI Orchestrator:</span>
                  <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${isDark ? 'bg-slate-900 text-indigo-300' : 'bg-slate-100 text-indigo-600'}`}>
                    {activeProvider}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      onLogout();
                      setMobileMenuOpen(false);
                    }}
                    className="flex-1 py-2.5 px-3 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout Session
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PROFILE MODAL --- */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              className="fixed inset-0 bg-black/60 cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-md rounded-2xl border p-6 shadow-2xl z-10 transition-colors duration-300 ${
                isDark ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-lg">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Profile Settings</h3>
                    <p className="text-[10px] text-slate-400">View and update your developer identity</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowProfileModal(false)}
                  className={`p-1 rounded-lg border transition-all cursor-pointer ${
                    isDark 
                      ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white' 
                      : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Profile Details Grid */}
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-3.5 rounded-xl border border-dashed dark:border-slate-850/60 bg-slate-50/50 dark:bg-slate-900/10">
                  {renderProfessionalAvatar(currentUser?.uid || '1', getDisplayName())}
                  <div>
                    <h4 className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{getDisplayName()}</h4>
                    <p className="text-[9px] text-slate-400 mt-0.5 uppercase tracking-wider font-extrabold">{currentUser?.role || 'Developer'}</p>
                  </div>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="text-slate-400 text-[9px] uppercase tracking-wide font-bold">Email Address</span>
                    <div className={`mt-1 p-2.5 rounded-lg border font-mono text-[11px] ${
                      isDark ? 'bg-slate-900/50 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                      {currentUser?.email}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-400 text-[9px] uppercase tracking-wide font-bold">Security Question</span>
                    <div className={`mt-1 p-2.5 rounded-lg border ${
                      isDark ? 'bg-slate-900/50 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                      {currentUser?.securityQuestion || 'No security question configured'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase tracking-wide font-bold">Member Since</span>
                      <div className={`mt-1 p-2.5 rounded-lg border font-mono text-[10px] ${
                        isDark ? 'bg-slate-900/50 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>
                        {currentUser?.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[9px] uppercase tracking-wide font-bold">Last Activity</span>
                      <div className={`mt-1 p-2.5 rounded-lg border font-mono text-[10px] ${
                        isDark ? 'bg-slate-900/50 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>
                        {currentUser?.lastLogin ? new Date(currentUser.lastLogin).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      setShowProfileModal(false);
                      setShowChangeUsernameModal(true);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-850' 
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Edit Username
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileModal(false);
                      setShowChangePasswordModal(true);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-850' 
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Change Password
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CHANGE USERNAME MODAL --- */}
      <AnimatePresence>
        {showChangeUsernameModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowChangeUsernameModal(false);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="fixed inset-0 bg-black/60 cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl z-10 transition-colors duration-300 ${
                isDark ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                    <Code2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Change Username</h3>
                    <p className="text-[10px] text-slate-400">Update your public profile display name</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowChangeUsernameModal(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`p-1 rounded-lg border transition-all cursor-pointer ${
                    isDark 
                      ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white' 
                      : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleUpdateUsername} className="space-y-4">
                <div>
                  <label className="text-slate-400 text-[9px] uppercase tracking-wide font-bold">New Display Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your new name"
                    value={newUsernameInput}
                    onChange={(e) => setNewUsernameInput(e.target.value)}
                    className={`w-full mt-1 px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/30' 
                        : 'bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-500 text-[10px] flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-[10px] flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangeUsernameModal(false);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-850' 
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction || !newUsernameInput.trim()}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loadingAction ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Save Changes'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- CHANGE PASSWORD MODAL --- */}
      <AnimatePresence>
        {showChangePasswordModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowChangePasswordModal(false);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className="fixed inset-0 bg-black/60 cursor-pointer"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className={`relative w-full max-w-sm rounded-2xl border p-6 shadow-2xl z-10 transition-colors duration-300 ${
                isDark ? 'bg-slate-950 border-slate-850 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-purple-500/10 text-purple-500 rounded-lg">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>Change Password</h3>
                    <p className="text-[10px] text-slate-400">Update your account password securely</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowChangePasswordModal(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className={`p-1 rounded-lg border transition-all cursor-pointer ${
                    isDark 
                      ? 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white' 
                      : 'border-slate-200 bg-white text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="text-slate-400 text-[9px] uppercase tracking-wide font-bold">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Min 6 characters"
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    className={`w-full mt-1 px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/30' 
                        : 'bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                <div>
                  <label className="text-slate-400 text-[9px] uppercase tracking-wide font-bold">Confirm Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Re-enter new password"
                    value={confirmPasswordInput}
                    onChange={(e) => setConfirmPasswordInput(e.target.value)}
                    className={`w-full mt-1 px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none focus:ring-1 transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 focus:border-cyan-500 focus:ring-cyan-500/30' 
                        : 'bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                {errorMsg && (
                  <div className="p-2.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-500 text-[10px] flex items-center gap-2">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-[10px] flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                <div className="pt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePasswordModal(false);
                      setErrorMsg('');
                      setSuccessMsg('');
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isDark 
                        ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-850' 
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loadingAction || !newPasswordInput || !confirmPasswordInput}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 dark:bg-cyan-600 dark:hover:bg-cyan-500 disabled:opacity-50 text-white py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {loadingAction ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      'Save Password'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
