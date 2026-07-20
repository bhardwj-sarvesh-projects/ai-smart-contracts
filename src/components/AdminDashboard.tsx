import React, { useState, useEffect } from 'react';
import { 
  Users, FolderGit2, ShieldAlert, Ban, CheckCircle, RefreshCw, 
  Search, Shield, UserCheck, Eye, ArrowLeft, BarChart3, Lock
} from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  lastLogin?: string;
}

interface ProjectData {
  id: string;
  userId?: string;
  name: string;
  blockchain: string;
  language: string;
  contractType: string;
  createdAt: string;
  audit?: {
    score: number;
    summary: string;
  };
}

interface AdminStats {
  totalUsers: number;
  totalProjects: number;
  avgAuditScore: number;
  blockchainCounts: Record<string, number>;
}

interface AdminDashboardProps {
  theme: 'dark' | 'light';
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onClose: () => void;
}

export default function AdminDashboard({ theme, authedFetch, onClose }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'users' | 'projects' | 'stats'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [projects, setProjects] = useState<ProjectData[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectData | null>(null);

  const fetchAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [usersRes, projectsRes, statsRes] = await Promise.all([
        authedFetch('/api/admin/users'),
        authedFetch('/api/admin/projects'),
        authedFetch('/api/admin/stats')
      ]);

      if (!usersRes.ok || !projectsRes.ok || !statsRes.ok) {
        throw new Error("Failed to load administrative details. Are you logged in as an administrator?");
      }

      const usersData = await usersRes.json();
      const projectsData = await projectsRes.json();
      const statsData = await statsRes.json();

      setUsers(usersData);
      setProjects(projectsData);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || "An unexpected admin loading error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleToggleStatus = async (userId: string) => {
    try {
      const res = await authedFetch(`/api/admin/users/${userId}/toggle-status`, {
        method: 'PUT'
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isActive: updated.isActive } : u));
      }
    } catch (err) {
      alert("Failed to modify user block status.");
    }
  };

  const handleToggleRole = async (userId: string, currentRole: string) => {
    const targetRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!window.confirm(`Are you sure you want to change this user's role to ${targetRole}?`)) return;
    try {
      const res = await authedFetch(`/api/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: targetRole })
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: updated.role } : u));
      }
    } catch (err) {
      alert("Failed to update user role.");
    }
  };

  const filteredUsers = users.filter(u => 
    u.fullName.toLowerCase().includes(userSearch.toLowerCase()) || 
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) || 
    p.blockchain.toLowerCase().includes(projectSearch.toLowerCase()) ||
    (p.contractType || '').toLowerCase().includes(projectSearch.toLowerCase())
  );

  const isDark = theme === 'dark';

  return (
    <div className={`flex-1 flex flex-col overflow-hidden min-h-0 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
    }`}>
      {/* Header section */}
      <div className={`px-6 py-5 border-b flex items-center justify-between shrink-0 ${
        isDark ? 'border-slate-900 bg-slate-950' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className={`p-2 rounded-xl transition-all ${
              isDark ? 'hover:bg-slate-900 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            }`}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold font-sans tracking-tight">System Control Panel</h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-red-600 bg-red-50 rounded-md border border-red-100">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-slate-400">Manage registered members, inspect platform workspaces, and audit stats</p>
          </div>
        </div>

        <button 
          onClick={fetchAdminData}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.98] ${
            isDark 
              ? 'border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300' 
              : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
          }`}
        >
          <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          Sync
        </button>
      </div>

      {error ? (
        <div className="p-8 text-center max-w-md mx-auto space-y-4">
          <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-md font-bold">Access Denied</h2>
          <p className="text-xs text-slate-400">{error}</p>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold"
          >
            Return to Safety
          </button>
        </div>
      ) : isLoading && !users.length ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <svg className="animate-spin h-8 w-8 text-blue-600 mb-3" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-xs font-medium text-slate-400 font-mono">RETRIEVING PLATFORM LEDGERS...</span>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Sub-navbar */}
          <div className={`px-6 border-b shrink-0 flex items-center gap-4 ${
            isDark ? 'border-slate-900 bg-slate-950/40' : 'border-slate-200 bg-slate-50/50'
          }`}>
            <button
              onClick={() => { setActiveTab('users'); setSelectedProject(null); }}
              className={`flex items-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users size={14} />
              User Profiles ({users.length})
            </button>
            <button
              onClick={() => { setActiveTab('projects'); setSelectedProject(null); }}
              className={`flex items-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FolderGit2 size={14} />
              Platform Workspaces ({projects.length})
            </button>
            <button
              onClick={() => { setActiveTab('stats'); setSelectedProject(null); }}
              className={`flex items-center gap-1.5 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer ${
                activeTab === 'stats'
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 size={14} />
              Analytics Dashboard
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 min-h-0">
            {/* Tab: Users */}
            {activeTab === 'users' && (
              <div className="space-y-4">
                <div className="relative max-w-sm">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users by name or email..."
                    className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-4 transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500 focus:ring-blue-950/40 focus:border-blue-500' 
                        : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-blue-100 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div className={`overflow-hidden border rounded-2xl ${
                  isDark ? 'border-slate-900 bg-slate-950' : 'border-slate-200 bg-white'
                }`}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                        isDark ? 'border-slate-900 bg-slate-900/40 text-slate-400' : 'border-slate-150 bg-slate-50/50 text-slate-500'
                      }`}>
                        <th className="px-6 py-3.5">User</th>
                        <th className="px-6 py-3.5">Role</th>
                        <th className="px-6 py-3.5">Account Status</th>
                        <th className="px-6 py-3.5">Joined Date</th>
                        <th className="px-6 py-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60 text-xs">
                      {filteredUsers.map((u) => {
                        const isSelf = u.email === 'sarveshtiwarisarvesh@gmail.com';
                        return (
                          <tr key={u.uid} className={isDark ? 'hover:bg-slate-900/20' : 'hover:bg-slate-50/20'}>
                            <td className="px-6 py-4">
                              <div className="font-semibold">{u.fullName || 'Registered User'}</div>
                              <div className="text-[10px] text-slate-400 mt-0.5">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/40'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400 border border-slate-200/50 dark:border-slate-800/80'
                              }`}>
                                {u.role === 'admin' ? 'Administrator' : 'Contractor'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                u.isActive !== false
                                  ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200/50 dark:border-green-900/40'
                                  : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400 border border-red-200/50 dark:border-red-900/40'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.isActive !== false ? 'bg-green-500' : 'bg-red-500'}`} />
                                {u.isActive !== false ? 'Active' : 'Blocked'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-400">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  disabled={isSelf}
                                  onClick={() => handleToggleRole(u.uid, u.role)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase border transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${
                                    isDark 
                                      ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' 
                                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                  title="Toggle User Role"
                                >
                                  Role
                                </button>

                                <button
                                  disabled={isSelf}
                                  onClick={() => handleToggleStatus(u.uid)}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold tracking-wider uppercase border transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer ${
                                    u.isActive !== false
                                      ? 'border-red-200 bg-red-50 hover:bg-red-100/60 text-red-600 dark:bg-red-950/20 dark:border-red-900/40 dark:text-red-400'
                                      : 'border-green-200 bg-green-50 hover:bg-green-100/60 text-green-600 dark:bg-green-950/20 dark:border-green-900/40 dark:text-green-400'
                                  }`}
                                >
                                  {u.isActive !== false ? <Ban size={11} /> : <CheckCircle size={11} />}
                                  {u.isActive !== false ? 'Block' : 'Unblock'}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                            No registered users found matching the query.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab: Projects */}
            {activeTab === 'projects' && !selectedProject && (
              <div className="space-y-4">
                <div className="relative max-w-sm">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                    <Search size={16} />
                  </span>
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search smart contracts by name or blockchain..."
                    className={`w-full pl-10 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:ring-4 transition-all ${
                      isDark 
                        ? 'bg-slate-900 border-slate-800 text-slate-100 placeholder-slate-500 focus:ring-blue-950/40 focus:border-blue-500' 
                        : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:ring-blue-100 focus:border-blue-500'
                    }`}
                  />
                </div>

                <div className={`overflow-hidden border rounded-2xl ${
                  isDark ? 'border-slate-900 bg-slate-950' : 'border-slate-200 bg-white'
                }`}>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`border-b text-[10px] font-bold uppercase tracking-wider ${
                        isDark ? 'border-slate-900 bg-slate-900/40 text-slate-400' : 'border-slate-150 bg-slate-50/50 text-slate-500'
                      }`}>
                        <th className="px-6 py-3.5">Contract Name</th>
                        <th className="px-6 py-3.5">Blockchain</th>
                        <th className="px-6 py-3.5">Contract Type</th>
                        <th className="px-6 py-3.5">Security Score</th>
                        <th className="px-6 py-3.5">Created Date</th>
                        <th className="px-6 py-3.5 text-right">Inspect</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-900/60 text-xs">
                      {filteredProjects.map((p) => (
                        <tr key={p.id} className={isDark ? 'hover:bg-slate-900/20' : 'hover:bg-slate-50/20'}>
                          <td className="px-6 py-4">
                            <div className="font-semibold">{p.name}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">ID: {p.id}</div>
                          </td>
                          <td className="px-6 py-4 uppercase font-mono text-[10px] tracking-wider text-slate-400">
                            {p.blockchain} ({p.language})
                          </td>
                          <td className="px-6 py-4">
                            {p.contractType || 'Custom Contract'}
                          </td>
                          <td className="px-6 py-4">
                            {p.audit ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.audit.score >= 85
                                  ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400'
                                  : p.audit.score >= 60
                                    ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400'
                                    : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400'
                              }`}>
                                {p.audit.score}/100
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">Unaudited</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-400">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedProject(p)}
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                isDark 
                                  ? 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800' 
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <Eye size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {filteredProjects.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-slate-400">
                            No generated smart contracts found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Inspect Project view */}
            {selectedProject && (
              <div className="space-y-6">
                <button
                  onClick={() => setSelectedProject(null)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    isDark ? 'text-slate-300 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowLeft size={14} /> Back to listing
                </button>

                <div className={`p-6 rounded-2xl border ${
                  isDark ? 'border-slate-900 bg-slate-900/30' : 'border-slate-200 bg-white shadow-sm'
                } space-y-4`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold font-sans tracking-tight">{selectedProject.name}</h2>
                      <p className="text-xs text-slate-400 uppercase tracking-widest font-mono mt-0.5">
                        BLOCKCHAIN: {selectedProject.blockchain} | TYPE: {selectedProject.contractType}
                      </p>
                    </div>

                    {selectedProject.audit && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 font-semibold uppercase">Security Audit Rating:</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          selectedProject.audit.score >= 85
                            ? 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400 border border-green-200/20'
                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400 border border-yellow-200/20'
                        }`}>
                          {selectedProject.audit.score}/100
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedProject.audit?.summary && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-900/40">
                      <h3 className="text-xs font-bold uppercase tracking-wider mb-2">Audit Summary</h3>
                      <p className="text-xs text-slate-400 leading-relaxed bg-slate-900 p-4 rounded-xl font-mono">
                        {selectedProject.audit.summary}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Stats */}
            {activeTab === 'stats' && stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-6 rounded-2xl border ${
                  isDark ? 'border-slate-900 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'
                } flex items-center gap-4`}>
                  <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
                    <Users size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-mono">{stats.totalUsers}</div>
                    <div className="text-xs text-slate-400 font-medium">Registered Platform Users</div>
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border ${
                  isDark ? 'border-slate-900 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'
                } flex items-center gap-4`}>
                  <div className="p-3 bg-green-500/10 text-green-500 rounded-xl">
                    <FolderGit2 size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-mono">{stats.totalProjects}</div>
                    <div className="text-xs text-slate-400 font-medium">Generated Workspaces</div>
                  </div>
                </div>

                <div className={`p-6 rounded-2xl border ${
                  isDark ? 'border-slate-900 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'
                } flex items-center gap-4`}>
                  <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
                    <Shield size={24} />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-mono">{stats.avgAuditScore}/100</div>
                    <div className="text-xs text-slate-400 font-medium">Average Security Audit Score</div>
                  </div>
                </div>

                <div className={`md:col-span-3 p-6 rounded-2xl border ${
                  isDark ? 'border-slate-900 bg-slate-900/40' : 'border-slate-200 bg-white shadow-sm'
                } space-y-4`}>
                  <h3 className="text-xs font-bold uppercase tracking-wider">Blockchain Deployment Breakdown</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                    {Object.entries(stats.blockchainCounts).map(([chain, count]) => (
                      <div key={chain} className={`p-4 rounded-xl border text-center ${
                        isDark ? 'border-slate-800 bg-slate-900/20' : 'border-slate-100 bg-slate-50'
                      }`}>
                        <div className="text-xs font-bold uppercase text-slate-400 font-mono">{chain}</div>
                        <div className="text-xl font-bold font-mono text-blue-500 mt-1">{count}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">contracts</div>
                      </div>
                    ))}
                    {Object.keys(stats.blockchainCounts).length === 0 && (
                      <div className="col-span-4 text-center text-xs text-slate-400 py-4">
                        No blockchain breakdown stats available yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
