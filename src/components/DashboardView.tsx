import React, { useState, useMemo } from 'react';
import { 
  Plus, Search, Trash2, Code2, Shield, Eye, Calendar, FileCode, CheckCircle, 
  Layers, ChevronRight, Activity, TrendingUp, AlertTriangle, Cpu
} from 'lucide-react';
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
      blockchainCounts[p.blockchain] = (blockchainCounts[p.blockchain] || 0) + 1;
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
    <div className={`flex-1 overflow-y-auto p-6 md:p-8 space-y-8 min-h-0 ${
      theme === 'dark' ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Upper Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl md:text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            SmartContract.ai Dashboard
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Build, analyze, and inspect your enterprise blockchain workspace contracts safely.
          </p>
        </div>
        <button
          onClick={onNewProjectClick}
          className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-md transition-all self-start md:self-auto"
          id="btn-create-dashboard"
        >
          <Plus className="w-4 h-4" />
          Create New Smart Contract
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
          theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Contracts</span>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${theme === 'dark' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-cyan-50 text-cyan-600'}`}>
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* Audited count */}
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
          theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Audits Completed</span>
            <p className="text-2xl font-bold">{stats.audited}</p>
          </div>
          <div className={`p-2.5 rounded-lg ${theme === 'dark' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <Shield className="w-5 h-5" />
          </div>
        </div>

        {/* Average Safety Score */}
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
          theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Average Safety Score</span>
            <p className={`text-2xl font-bold ${
              stats.avgScore === null ? 'text-slate-400' : stats.avgScore >= 90 ? 'text-emerald-500' : stats.avgScore >= 75 ? 'text-amber-500' : 'text-red-500'
            }`}>
              {stats.avgScore !== null ? `${stats.avgScore}/100` : 'N/A'}
            </p>
          </div>
          <div className={`p-2.5 rounded-lg ${
            stats.avgScore !== null && stats.avgScore >= 90
              ? 'bg-emerald-500/10 text-emerald-400'
              : stats.avgScore !== null && stats.avgScore >= 75
              ? 'bg-amber-500/10 text-amber-400'
              : 'bg-slate-500/10 text-slate-400'
          }`}>
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Blockchain Ecosystem breakdown */}
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-sm ${
          theme === 'dark' ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
        }`}>
          <div className="space-y-1 w-full">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Chains</span>
            <div className="flex gap-2 text-xs text-slate-400 font-medium overflow-x-auto pt-1 whitespace-nowrap">
              {Object.keys(stats.blockchainCounts).length === 0 ? (
                <span>No deployments</span>
              ) : (
                Object.entries(stats.blockchainCounts).map(([chain, count]) => (
                  <span key={chain} className={`px-1.5 py-0.5 rounded border text-[10px] ${
                    theme === 'dark' ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}>
                    {chain}: {count}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and search controllers */}
      <div className={`p-4 rounded-xl border flex flex-col sm:flex-row gap-3 items-center shadow-sm ${
        theme === 'dark' ? 'bg-slate-900/20 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by workspace title, contract template or purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full text-xs pl-9 pr-4 py-2 rounded-lg border focus:outline-none focus:ring-1 ${
              theme === 'dark'
                ? 'bg-slate-950 border-slate-800 text-slate-200 focus:ring-cyan-500 focus:border-cyan-500'
                : 'bg-white border-slate-200 text-slate-800 focus:ring-cyan-500 focus:border-cyan-500'
            }`}
          />
        </div>
        
        {/* Blockchain Selector filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-400 whitespace-nowrap">Chain:</span>
          <select
            value={blockchainFilter}
            onChange={(e) => setBlockchainFilter(e.target.value)}
            className={`text-xs p-2 rounded-lg border focus:outline-none w-full sm:w-auto ${
              theme === 'dark'
                ? 'bg-slate-950 border-slate-800 text-slate-200'
                : 'bg-white border-slate-200 text-slate-800'
            }`}
          >
            <option value="all">All Ecosystems</option>
            <option value="ethereum">Ethereum (Solidity)</option>
            <option value="solana">Solana (Rust)</option>
            <option value="sui">Sui (Move)</option>
            <option value="aptos">Aptos (Move)</option>
            <option value="ton">TON (Tact)</option>
          </select>
        </div>
      </div>

      {/* Projects Grid view */}
      {filteredProjects.length === 0 ? (
        <div className={`p-12 text-center rounded-xl border border-dashed ${
          theme === 'dark' ? 'border-slate-800 bg-slate-900/10' : 'border-slate-200 bg-white'
        }`}>
          <FileCode className="w-10 h-10 mx-auto text-slate-500 mb-3" />
          <h3 className="text-sm font-semibold">No workspaces found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchQuery || blockchainFilter !== 'all' 
              ? "Try broadening your search filters or clear inputs." 
              : "Get started by generating your first production-ready smart contract."}
          </p>
          {!searchQuery && blockchainFilter === 'all' && (
            <button
              onClick={onNewProjectClick}
              className="mt-4 inline-flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-md transition-colors"
            >
              <Plus className="w-4 h-4" /> New Contract Workspace
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const hasAudit = !!project.audit;
            const score = project.audit?.score;
            
            // Format creation date
            const createdDate = project.createdAt 
              ? new Date(project.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : 'Unknown date';

            return (
              <div 
                key={project.id}
                className={`group rounded-xl border flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300 relative ${
                  theme === 'dark' 
                    ? 'bg-slate-900/30 hover:bg-slate-900/60 border-slate-800 hover:border-slate-700/80' 
                    : 'bg-white hover:bg-slate-50/55 border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Visual Status Indicator Top Bar */}
                <div className={`h-1.5 rounded-t-xl w-full bg-gradient-to-r ${
                  project.blockchain === 'ethereum' 
                    ? 'from-blue-500 to-indigo-500' 
                    : project.blockchain === 'solana' 
                    ? 'from-purple-500 to-emerald-500'
                    : 'from-cyan-500 to-teal-500'
                }`} />

                {/* Card Content Body */}
                <div className="p-5 flex-1 space-y-4">
                  {/* Title and metadata */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className={`font-bold text-sm tracking-tight group-hover:text-cyan-500 transition-colors ${
                        theme === 'dark' ? 'text-slate-100' : 'text-slate-900'
                      }`}>
                        {project.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-mono tracking-wide">
                        Template: <span className="text-cyan-500">{project.contractType}</span>
                      </p>
                    </div>

                    {/* Audit Indicator badge */}
                    {hasAudit ? (
                      <div className={`flex flex-col items-center justify-center h-10 w-10 rounded-full border shadow-inner ${
                        score! >= 90 
                          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' 
                          : score! >= 75 
                          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400' 
                          : 'border-red-500/40 bg-red-500/10 text-red-400'
                      }`} title={`Audit safety score: ${score}/100`}>
                        <span className="text-xs font-bold leading-none">{score}</span>
                        <span className="text-[7px] uppercase font-bold tracking-tighter text-slate-400 mt-0.5">Safety</span>
                      </div>
                    ) : (
                      <div className={`flex flex-col items-center justify-center h-10 w-10 rounded-full border border-slate-800 bg-slate-900/40 text-slate-400`} title="Unaudited Contract">
                        <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[6px] uppercase font-bold tracking-tighter text-slate-500 mt-0.5">Unaudited</span>
                      </div>
                    )}
                  </div>

                  {/* Description snippet */}
                  <p className="text-xs text-slate-400 line-clamp-2 h-8 leading-relaxed">
                    {project.description || 'Custom structured smart contract workspace.'}
                  </p>

                  {/* Tech indicators */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded tracking-wide border ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      ⛓️ {project.blockchain}
                    </span>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded tracking-wide border ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      💻 {project.language}
                    </span>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded tracking-wide border ${
                      theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}>
                      ⚙️ {project.framework}
                    </span>
                  </div>

                  {/* Additional mini-stats (Files, Versions, Deployments) */}
                  <div className={`grid grid-cols-3 gap-2 py-2 px-3 rounded-lg border text-center ${
                    theme === 'dark' ? 'bg-slate-950/40 border-slate-900' : 'bg-slate-100/50 border-slate-200/50'
                  }`}>
                    <div className="space-y-0.5">
                      <span className="text-[8px] uppercase text-slate-400 block tracking-wider">Modules</span>
                      <span className="text-xs font-bold text-slate-300">{project.files.length}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] uppercase text-slate-400 block tracking-wider">Versions</span>
                      <span className="text-xs font-bold text-slate-300">{(project.versions || []).length}</span>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[8px] uppercase text-slate-400 block tracking-wider">Deploys</span>
                      <span className="text-xs font-bold text-slate-300">{(project.deployments || []).length}</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className={`p-4 border-t flex items-center justify-between gap-2 rounded-b-xl ${
                  theme === 'dark' ? 'border-slate-800/80 bg-slate-950/50' : 'border-slate-200/80 bg-slate-100/30'
                }`}>
                  <button
                    onClick={() => onDeleteProject(project.id)}
                    className={`p-1.5 rounded text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors`}
                    title="Delete workspace"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    {/* Select/Audit workspace button */}
                    <button
                      onClick={() => onSelectProject(project.id, 'auditing')}
                      className={`text-[10px] font-semibold px-2.5 py-1.5 rounded border flex items-center gap-1 hover:text-cyan-400 transition-colors ${
                        theme === 'dark'
                          ? 'border-slate-800 bg-slate-900/60 text-slate-300 hover:bg-slate-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Shield className="w-3 h-3 text-emerald-500" />
                      Audit
                    </button>
                    {/* Go to IDE workspace */}
                    <button
                      onClick={() => onSelectProject(project.id, 'workspace')}
                      className="text-[10px] font-semibold bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-all shadow-sm"
                    >
                      <Code2 className="w-3 h-3" />
                      Open Workspace
                    </button>
                  </div>
                </div>

                {/* Card hover subtle indicator icon */}
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
