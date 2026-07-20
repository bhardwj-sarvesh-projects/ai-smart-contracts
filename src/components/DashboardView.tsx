import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Trash2, Code2, Shield, Eye, Calendar, FileCode, CheckCircle, 
  Layers, ChevronRight, Activity, TrendingUp, AlertTriangle, Cpu, Globe, Zap
} from 'lucide-react';
import { motion } from 'motion/react';
import { Project } from '../types';

interface DashboardViewProps {
  projects: Project[];
  theme: 'dark' | 'light';
  onSelectProject: (id: string, tab?: 'workspace' | 'auditing') => void;
  onNewProjectClick: () => void;
  onDeleteProject: (id: string) => void;
}

export default function DashboardView({
  projects,
  theme,
  onSelectProject,
  onNewProjectClick,
  onDeleteProject
}: DashboardViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [blockchainFilter, setBlockchainFilter] = useState('all');

  // Stats Calculations
  const stats = useMemo(() => {
    const total = projects.length;
    const audited = projects.filter(p => p.audit).length;
    
    let sumScore = 0;
    let validScoresCount = 0;
    projects.forEach(p => {
      if (p.audit?.score !== undefined) {
        sumScore += p.audit.score;
        validScoresCount++;
      }
    });
    
    const avgScore = validScoresCount > 0 ? Math.round(sumScore / validScoresCount) : null;
    
    // Blockchain breakdown
    const blockchainCounts: Record<string, number> = {};
    projects.forEach(p => {
      const displayChain = p.blockchain.charAt(0).toUpperCase() + p.blockchain.slice(1);
      blockchainCounts[displayChain] = (blockchainCounts[displayChain] || 0) + 1;
    });

    return {
      total,
      audited,
      avgScore,
      blockchainCounts
    };
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.contractType.toLowerCase().includes(searchQuery.toLowerCase());
        
      const matchesBlockchain = blockchainFilter === 'all' || p.blockchain === blockchainFilter;
      
      return matchesSearch && matchesBlockchain;
    });
  }, [projects, searchQuery, blockchainFilter]);

  return (
    <div className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-8 min-h-0 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50/50 text-slate-800'
    }`}>
      
      {/* 1. Hero Call-To-Action (HIGHLIGHTING "Create New Project" as primary action) */}
      <motion.div 
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-2xl border p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl ${
          theme === 'dark' 
            ? 'bg-gradient-to-br from-slate-900/80 via-slate-950 to-indigo-950/20 border-slate-800/80 shadow-slate-950/40' 
            : 'bg-gradient-to-br from-white via-slate-50/50 to-cyan-50/20 border-slate-200/80 shadow-slate-200/30'
        }`}
      >
        {/* Decorative dynamic ambient glow */}
        <div className="absolute right-0 top-0 -mt-12 -mr-12 w-72 h-72 rounded-full bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 blur-3xl pointer-events-none" />
        
        <div className="space-y-2 max-w-xl relative z-10">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase font-mono ${
            theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-cyan-50 text-cyan-600 border border-cyan-200'
          }`}>
            <Zap className="w-3 h-3 fill-current" /> Next-Gen AI IDE
          </span>
          <h1 className={`text-2xl md:text-3xl font-extrabold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Secure smart contracts, simplified.
          </h1>
          <p className={`text-xs md:text-sm leading-relaxed ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Compose optimized Solidity, Rust, and Move contracts in seconds using unified multi-model intelligence. Audit vulnerabilities before code touches the mainnet.
          </p>
        </div>

        <div className="shrink-0 relative z-10">
          <button
            onClick={onNewProjectClick}
            className="w-full md:w-auto h-12 flex items-center justify-center gap-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 active:scale-98 text-white px-6 rounded-xl text-sm font-extrabold shadow-lg shadow-cyan-600/20 hover:shadow-cyan-500/30 transition-all duration-200 cursor-pointer"
            id="btn-create-dashboard"
          >
            <Plus className="w-5 h-5" />
            Create New Project
          </button>
        </div>
      </motion.div>

      {/* 2. Stats Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className={`p-5 rounded-2xl border flex items-center justify-between shadow-sm transition-all hover:scale-101 ${
          theme === 'dark' ? 'bg-slate-900/30 border-slate-850/80' : 'bg-white border-slate-200/65'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider font-mono">Total Projects</span>
            <p className={`text-2xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.total}</p>
          </div>
          <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/10' : 'bg-cyan-50 text-cyan-600 border border-cyan-100'}`}>
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Audits Completed */}
        <div className={`p-5 rounded-2xl border flex items-center justify-between shadow-sm transition-all hover:scale-101 ${
          theme === 'dark' ? 'bg-slate-900/30 border-slate-850/80' : 'bg-white border-slate-200/65'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider font-mono">Audited Contracts</span>
            <p className={`text-2xl font-extrabold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{stats.audited}</p>
          </div>
          <div className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/10' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
            <Shield className="w-5 h-5" />
          </div>
        </div>

        {/* Safety Quotient */}
        <div className={`p-5 rounded-2xl border flex items-center justify-between shadow-sm transition-all hover:scale-101 ${
          theme === 'dark' ? 'bg-slate-900/30 border-slate-850/80' : 'bg-white border-slate-200/65'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider font-mono">Avg Safety Score</span>
            <p className={`text-2xl font-extrabold ${
              stats.avgScore === null ? 'text-slate-400' : stats.avgScore >= 90 ? 'text-emerald-500' : stats.avgScore >= 75 ? 'text-amber-500' : 'text-rose-500'
            }`}>
              {stats.avgScore !== null ? `${stats.avgScore}/100` : 'N/A'}
            </p>
          </div>
          <div className={`p-3 rounded-xl ${
            stats.avgScore !== null && stats.avgScore >= 90
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
              : stats.avgScore !== null && stats.avgScore >= 75
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
              : 'bg-slate-500/10 text-slate-400 border border-slate-200'
          }`}>
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Active Chains breakdown */}
        <div className={`p-5 rounded-2xl border flex items-center justify-between shadow-sm transition-all hover:scale-101 ${
          theme === 'dark' ? 'bg-slate-900/30 border-slate-850/80' : 'bg-white border-slate-200/65'
        }`}>
          <div className="space-y-1.5 w-full">
            <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider font-mono block">Ecosystems</span>
            <div className="flex gap-1.5 text-xs text-slate-400 font-medium overflow-x-auto pb-0.5 no-scrollbar max-w-full">
              {Object.keys(stats.blockchainCounts).length === 0 ? (
                <span className="text-xs text-slate-500">No active chains</span>
              ) : (
                Object.entries(stats.blockchainCounts).map(([chain, count]) => (
                  <span key={chain} className={`px-2 py-0.5 rounded-lg border text-[9px] font-extrabold uppercase font-mono tracking-wider ${
                    theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}>
                    {chain} ({count})
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filtering & Search section */}
      <div className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-3 items-center shadow-sm ${
        theme === 'dark' ? 'bg-slate-900/20 border-slate-850/70' : 'bg-white border-slate-200/70'
      }`}>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by workspace title, template or purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full h-10 text-xs pl-10 pr-4 rounded-xl border focus:outline-none focus:ring-1 focus:ring-cyan-500/40 focus:border-cyan-500 ${
              theme === 'dark'
                ? 'bg-slate-950 border-slate-850 text-slate-200 focus:bg-slate-950/85'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          />
        </div>
        
        {/* Blockchain Ecosystem selector filter */}
        <div className="flex items-center gap-2.5 w-full md:w-auto h-10 shrink-0">
          <span className="text-xs font-semibold text-slate-400">Ecosystem:</span>
          <select
            value={blockchainFilter}
            onChange={(e) => setBlockchainFilter(e.target.value)}
            className={`text-xs h-full px-3 rounded-xl border focus:outline-none cursor-pointer w-full md:w-auto ${
              theme === 'dark'
                ? 'bg-slate-950 border-slate-850 text-slate-200 focus:border-cyan-500'
                : 'bg-white border-slate-200 text-slate-800 focus:border-cyan-500'
            }`}
          >
            <option value="all">All Chains</option>
            <option value="ethereum">Ethereum (Solidity)</option>
            <option value="solana">Solana (Rust)</option>
            <option value="sui">Sui (Move)</option>
            <option value="aptos">Aptos (Move)</option>
            <option value="ton">TON (Tact)</option>
          </select>
        </div>
      </div>

      {/* 4. Projects Workspaces Grid */}
      {filteredProjects.length === 0 ? (
        <div className={`p-12 text-center rounded-2xl border border-dashed flex flex-col items-center justify-center ${
          theme === 'dark' ? 'border-slate-800 bg-slate-900/10' : 'border-slate-200 bg-white/50'
        }`}>
          <FileCode className="w-12 h-12 text-slate-400 mb-4 animate-pulse" />
          <h3 className="text-sm font-bold tracking-tight">No smart contracts found</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {searchQuery || blockchainFilter !== 'all' 
              ? "No matching projects meet your active search parameters. Try broadening your query filter." 
              : "Get started on BlockOnMate by creating your very first secure AI smart contract."}
          </p>
          {!searchQuery && blockchainFilter === 'all' && (
            <button
              onClick={onNewProjectClick}
              className="mt-5 inline-flex h-10 items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create Workspace
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project, idx) => {
            const hasAudit = !!project.audit;
            const score = project.audit?.score;
            
            // Format creation date
            const createdDate = project.createdAt 
              ? new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Unknown date';

            return (
              <motion.div 
                key={project.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.3) }}
                className={`group rounded-2xl border flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 relative ${
                  theme === 'dark' 
                    ? 'bg-slate-900/20 hover:bg-slate-900/50 border-slate-850 hover:border-slate-750/80' 
                    : 'bg-white hover:bg-white border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Visual Status Indicator Top Ribbon */}
                <div className={`h-1.5 rounded-t-2xl w-full bg-gradient-to-r ${
                  project.blockchain === 'solana' 
                    ? 'from-purple-500 via-indigo-500 to-emerald-400' 
                    : project.blockchain === 'ethereum'
                    ? 'from-blue-600 via-cyan-500 to-indigo-500'
                    : 'from-cyan-500 to-teal-400'
                }`} />

                {/* Card Header and Metadata */}
                <div className="p-6 flex-1 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 max-w-[70%]">
                      <h3 className={`font-bold text-base tracking-tight group-hover:text-cyan-500 transition-colors truncate ${
                        theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                      }`}>
                        {project.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono tracking-wide">
                        Template: <span className="font-semibold text-cyan-500">{project.contractType}</span>
                      </p>
                    </div>

                    {/* Audit Score Badge */}
                    {hasAudit ? (
                      <div className={`flex flex-col items-center justify-center h-11 w-11 rounded-full border shadow-inner transition-transform duration-200 group-hover:scale-105 ${
                        score! >= 90 
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' 
                          : score! >= 75 
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' 
                          : 'border-rose-500/30 bg-rose-500/10 text-rose-400'
                      }`} title={`Audit safety score: ${score}/100`}>
                        <span className="text-xs font-extrabold leading-none">{score}</span>
                        <span className="text-[7px] uppercase font-bold tracking-tighter text-slate-400 mt-0.5">Safety</span>
                      </div>
                    ) : (
                      <div className={`flex flex-col items-center justify-center h-11 w-11 rounded-full border border-slate-800 bg-slate-950 text-slate-400`} title="Unaudited Contract">
                        <AlertTriangle className="w-3.5 h-3.5 text-slate-500 animate-pulse" />
                        <span className="text-[6px] uppercase font-extrabold tracking-tighter text-slate-500 mt-0.5">None</span>
                      </div>
                    )}
                  </div>

                  {/* Description snippet */}
                  <p className={`text-xs h-9 line-clamp-2 leading-relaxed ${theme === 'dark' ? 'text-slate-400/90' : 'text-slate-500'}`}>
                    {project.description || 'Custom smart contract workspace designed with AI.'}
                  </p>

                  {/* Tech indicators */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-lg tracking-wider border font-mono ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      ⛓️ {project.blockchain}
                    </span>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-lg tracking-wider border font-mono ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      💻 {project.language}
                    </span>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-lg tracking-wider border font-mono ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-850 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      ⚙️ {project.framework}
                    </span>
                  </div>

                  {/* Additional Mini-Stats Row */}
                  <div className={`grid grid-cols-3 gap-2 py-2 px-3 rounded-xl border text-center ${
                    theme === 'dark' ? 'bg-slate-950/50 border-slate-900' : 'bg-slate-50 border-slate-150'
                  }`}>
                    <div className="space-y-0.5">
                      <span className="text-[8px] uppercase text-slate-500 block font-bold tracking-wider font-mono">Modules</span>
                      <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{project.files.length}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] uppercase text-slate-500 block font-bold tracking-wider font-mono">Versions</span>
                      <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{(project.versions || []).length}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] uppercase text-slate-500 block font-bold tracking-wider font-mono">Deployments</span>
                      <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-slate-700'}`}>{(project.deployments || []).length}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className={`p-4 border-t flex items-center justify-between gap-2 rounded-b-2xl ${
                  theme === 'dark' ? 'border-slate-850/80 bg-slate-950/40' : 'border-slate-200/50 bg-slate-50/50'
                }`}>
                  <button
                    onClick={() => onDeleteProject(project.id)}
                    className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-500/10 hover:text-rose-400 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
                    title="Delete workspace"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Select/Audit workspace button */}
                    <button
                      onClick={() => onSelectProject(project.id, 'auditing')}
                      className={`text-[10px] h-9 font-extrabold px-3 rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:text-cyan-400 hover:bg-slate-900 hover:border-slate-750'
                          : 'border-slate-200 bg-white text-slate-600 hover:text-cyan-600 hover:bg-slate-50'
                      }`}
                    >
                      <Shield className="w-3.5 h-3.5 text-emerald-500" />
                      Audit Hub
                    </button>
                    {/* Go to IDE workspace */}
                    <button
                      onClick={() => onSelectProject(project.id, 'workspace')}
                      className="text-[10px] h-9 font-extrabold bg-cyan-600 hover:bg-cyan-500 text-white px-3.5 rounded-xl flex items-center gap-1.5 transition-all shadow-sm shadow-cyan-600/10 cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                      IDE Workspace
                    </button>
                  </div>
                </div>

                {/* Card hover subtle indicator chevron */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
