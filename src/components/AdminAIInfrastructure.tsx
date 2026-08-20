import React, { useEffect, useRef, useState } from 'react';

import {
  Activity,
  CheckCircle2,
  CircleAlert,
  AlertCircle,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Power,
  TestTube2,
  AlertTriangle,
  Database,
  Cpu,
  Clock,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

interface Credential {
  id: string;
  provider: string;
  providerLabel?: string;
  model: string;
  baseUrl: string;
  displayName: string;
  maskedApiKey: string;
  keyConfigured: boolean;
  enabled: boolean;
  priority: number;
  routingGroup?: string;
  routingGroupLabel?: string;
  healthStatus: 'unknown' | 'healthy' | 'unhealthy' | 'rate_limited' | 'auth_error' | 'unavailable';
  lastLatencyMs?: number | null;
  cooldownUntil?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  totalRequests: number;
  totalFailures: number;
  createdAt?: string;
  updatedAt?: string;
}

interface StorageDiagnostics {
  mode: 'supabase';
  isProductionSafe: boolean;
  isEncrypted: boolean;
  supabaseAvailable?: boolean;
  failureReason: string | null;
  failureDetails: string | null;
  lastChecked: string;
  supabaseUrl?: string;
  tableName?: string;
  maxCredentials?: number;
  encryptionConfigured?: boolean;
}

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  theme: 'dark' | 'light';
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function AdminAIInfrastructure({ authedFetch, theme, showToast }: Props) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [storageDiagnostics, setStorageDiagnostics] = useState<StorageDiagnostics | null>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [policy, setPolicy] = useState<any>(null);
  const [routingGroups, setRoutingGroups] = useState<any[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [adding, setAdding] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [retryingStorage, setRetryingStorage] = useState(false);
  const isDark = theme === 'dark';
  const loadSequence = useRef(0);
  const mounted = useRef(true);


  const requestWithTimeout = async (url: string, options: RequestInit = {}, timeoutMs = 7000) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await authedFetch(url, { ...options, signal: controller.signal });
    } finally {
      window.clearTimeout(timer);
    }
  };

  const load = async (forceRefresh = false) => {
    const sequence = ++loadSequence.current;
    if (forceRefresh) setRefreshing(true);
    else setInitialLoading(true);
    setLoadError(null);
    try {
      const res = await requestWithTimeout(`/api/admin/ai/overview${forceRefresh ? `?refresh=${Date.now()}` : ''}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data: any = await res.json().catch(() => ({}));

      if (!mounted.current || sequence !== loadSequence.current) return;

      if (!res.ok) {
        throw new Error(formatApiError(data, `Unable to load AI infrastructure (HTTP ${res.status}).`));
      }

      if (data.diagnostics) setDiagnostics(data.diagnostics);
      if (data.storageDiagnostics) setStorageDiagnostics(data.storageDiagnostics);
      setCredentials(Array.isArray(data.credentials) ? data.credentials : []);
      setPolicy(data.policy || null);
      setRoutingGroups(Array.isArray(data.routingGroups) ? data.routingGroups : Array.isArray(data.policy?.routingGroups) ? data.policy.routingGroups : []);
      setLoadError(null);
    } catch (e: any) {
      if (mounted.current && sequence === loadSequence.current) {
        const errorMsg = e?.name === 'AbortError'
          ? 'AI infrastructure request timed out. Check the Supabase configuration and try again.'
          : errorMessage(e, 'AI infrastructure loading failed.');
        setLoadError(errorMsg);
        showToast?.(errorMsg, 'error');
      }
    } finally {
      if (mounted.current && sequence === loadSequence.current) {
        if (forceRefresh) setRefreshing(false);
        else setInitialLoading(false);
      }
    }
  };

  useEffect(() => {
    // React StrictMode intentionally mounts/effects twice in development.
    // Reset the lifecycle flag on every effect setup so the second setup is
    // not left permanently in the 'unmounted' state (which used to leave the
    // credential loader spinning forever).
    mounted.current = true;
    void load(false);

    return () => {
      mounted.current = false;
    };
  }, []);

  const formatApiError = (payload: any, fallback: string): string => {
    const candidates = [
      payload?.error?.message,
      payload?.error?.details,
      payload?.message,
      payload?.error,
      payload?.details,
    ];

    const message = candidates.find((value: unknown) => typeof value === 'string' && value.trim());
    if (message) return String(message);

    if (payload?.error && typeof payload.error === 'object') {
      try {
        return JSON.stringify(payload.error);
      } catch {
        // Ignore malformed/circular payloads.
      }
    }

    return fallback;
  };


  const errorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error && error.message && error.message !== '[object Object]') return error.message;
    if (typeof error === 'string' && error.trim()) return error;
    if (error && typeof error === 'object') {
      const candidate = (error as any).message || (error as any).error?.message || (error as any).error;
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
      try {
        return JSON.stringify(error);
      } catch {
        // Ignore serialization failures.
      }
    }
    return fallback;
  };

  const addCredential = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanKey = apiKey.trim();
    if (!cleanKey) return;
    if (cleanKey.length < 20 || !cleanKey.startsWith('gsk_')) {
      showToast?.("Invalid Groq API key format. Key must begin with 'gsk_' and be at least 20 characters.", 'error');
      return;
    }

    setAdding(true);
    try {
      const name = displayName.trim() || `Groq API ${credentials.length + 1}`;
      const res = await requestWithTimeout('/api/admin/ai/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: name, apiKey: cleanKey }),
      }, 10000);
      const data: any = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(formatApiError(data, `Failed to add credential (HTTP ${res.status}).`));

      if (data.credential) {
        setCredentials(current => {
          const withoutDuplicate = current.filter(item => item.id !== data.credential.id);
          return [...withoutDuplicate, data.credential].sort((a, b) => a.priority - b.priority);
        });
      }
      if (data.storageDiagnostics) setStorageDiagnostics(data.storageDiagnostics);
      setDisplayName('');
      setApiKey('');
      showToast?.('AI credential saved and verified in database.', 'success');
      // Re-read the authoritative row list after a successful write. This keeps
      // the UI synchronized with Supabase without showing the initial empty-state loader.
      void load(true);
    } catch (e: any) {
      showToast?.(e?.name === 'AbortError' ? 'Saving the credential timed out. The server did not confirm persistence.' : errorMessage(e, 'Failed to add credential.'), 'error');
    } finally {
      setAdding(false);
    }
  };

  const toggle = async (item: Credential) => {
    try {
      const res = await requestWithTimeout(`/api/admin/ai/credentials/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, 'Failed to change credential status.'));
      if (data.credential) {
        setCredentials(current => current.map(c => c.id === item.id ? data.credential : c));
      } else {
        setCredentials(current => current.map(c => c.id === item.id ? { ...c, enabled: !item.enabled } : c));
      }
      showToast?.(`Credential ${item.enabled ? 'disabled' : 'enabled'}.`, 'info');
    } catch (e: any) {
      showToast?.(e?.name === 'AbortError' ? 'Credential update timed out.' : errorMessage(e, 'Failed to change credential status.'), 'error');
    }
  };

  const remove = async (item: Credential) => {
    if (!window.confirm(`Delete "${item.displayName}"? This credential will be permanently removed from server storage.`)) return;
    try {
      const res = await requestWithTimeout(`/api/admin/ai/credentials/${item.id}`, { method: 'DELETE' }, 10000);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, 'Failed to delete credential.'));
      setCredentials(current => current.filter(c => c.id !== item.id));
      showToast?.('Credential deleted successfully.', 'success');
    } catch (e: any) {
      showToast?.(e?.name === 'AbortError' ? 'Credential deletion timed out.' : errorMessage(e, 'Failed to delete credential.'), 'error');
    }
  };

  const test = async (item: Credential) => {
    setTestingId(item.id);
    try {
      const res = await requestWithTimeout(`/api/admin/ai/credentials/${item.id}/test`, { method: 'POST' }, 20000);
      const data = await res.json().catch(() => ({ success: false, error: 'Invalid test response from server.' }));
      if (!res.ok) throw new Error(formatApiError(data, 'Credential test failed.'));
      const result = data.result || data;
      const succeeded = Boolean(result.success);
      const newStatus = succeeded ? 'healthy' : (result.failureType === 'AUTH_ERROR' ? 'auth_error' : result.failureType === 'RATE_LIMIT_ERROR' ? 'rate_limited' : 'unhealthy');
      setCredentials(current => current.map(c => c.id === item.id ? { ...c, healthStatus: newStatus as any, lastLatencyMs: result.latencyMs } : c));
      showToast?.(succeeded ? `Credential healthy · Latency: ${result.latencyMs}ms` : (result.error || 'Credential test failed.'), succeeded ? 'success' : 'error');
    } catch (e: any) {
      showToast?.(e?.name === 'AbortError' ? 'Credential health test timed out.' : errorMessage(e, 'Credential test failed.'), 'error');
    } finally {
      setTestingId(null);
    }
  };

  const retryStorage = async () => {
    setRetryingStorage(true);
    try {
      const res = await requestWithTimeout('/api/admin/ai/storage/retry', { method: 'POST' }, 10000);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(formatApiError(data, 'Storage check failed.'));
      if (data.storageDiagnostics) {
        setStorageDiagnostics(data.storageDiagnostics);
        if (data.storageDiagnostics.supabaseAvailable || data.storageDiagnostics.isProductionSafe) {
          showToast?.('Supabase database connection successfully verified and active.', 'success');
          await load(true);
        } else {
          showToast?.(`Supabase check: ${data.storageDiagnostics.failureDetails || 'Unavailable'}`, 'error');
        }
      }
    } catch (e: any) {
      showToast?.(e?.name === 'AbortError' ? 'Database check timed out.' : errorMessage(e, 'Storage check failed.'), 'error');
    } finally {
      setRetryingStorage(false);
    }
  };

  const getHealthBadge = (item: Credential) => {
    if (!item.enabled) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Disabled
        </span>
      );
    }

    switch (item.healthStatus) {
      case 'healthy':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Healthy {item.lastLatencyMs ? `· ${item.lastLatencyMs}ms` : ''}
          </span>
        );
      case 'auth_error':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-500 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Auth Error
          </span>
        );
      case 'rate_limited':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Rate Limited
          </span>
        );
      case 'unhealthy':
      case 'unavailable':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Unhealthy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Configured
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Primary Infrastructure Card */}
      <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="font-bold text-base tracking-tight">AI Infrastructure Control</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  20-key Groq Cloud resilience pool with preferred workload groups, automatic model discovery, and failover.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={initialLoading || refreshing}
              className={`px-3 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all ${
                isDark ? 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700'
              }`}
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Policy & Status Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className={`rounded-xl border p-3.5 ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Credentials</span>
              <Cpu size={14} className="opacity-70" />
            </div>
            <p className="text-2xl font-black tracking-tight">{credentials.length}<span className="text-sm text-slate-400">/{storageDiagnostics?.maxCredentials || 20}</span></p>
            <p className="text-[10px] text-slate-500 mt-0.5">Groq keys provisioned</p>
          </div>

          <div className={`rounded-xl border p-3.5 ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Active Pool</span>
              <Activity size={14} className="text-emerald-500" />
            </div>
            <p className="text-2xl font-black tracking-tight text-emerald-500">
              {credentials.filter(c => c.enabled).length}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Enabled for routing</p>
          </div>

          <div className={`rounded-xl border p-3.5 ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Temperature</span>
              <Lock size={13} className="text-indigo-400" />
            </div>
            <p className="text-2xl font-black tracking-tight text-indigo-400">
              {policy?.temperature ?? 0.1}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Deterministic (Locked)</p>
          </div>

          <div className={`rounded-xl border p-3.5 ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider">Generation Default</span>
              <Lock size={13} className="text-indigo-400" />
            </div>
            <p className="text-2xl font-black tracking-tight text-indigo-400">
              {(policy?.defaultMaxOutputTokens ?? 2000).toLocaleString()}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Predictable per-file default</p>
          </div>
        </div>

        {/* Storage Health & Diagnostics Banner */}
        <div className={`mb-6 rounded-xl border p-3.5 flex items-start justify-between gap-3 text-xs ${
          storageDiagnostics && (!storageDiagnostics.supabaseAvailable || storageDiagnostics.encryptionConfigured === false)
            ? 'border-amber-500/30 bg-amber-500/5 text-amber-400'
            : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
        }`}>
          <div className="flex items-start gap-2.5">
            <Database size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold ${storageDiagnostics && (!storageDiagnostics.supabaseAvailable || storageDiagnostics.encryptionConfigured === false) ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {storageDiagnostics?.encryptionConfigured === false ? 'Supabase Storage Ready · Encryption Secret Missing' : storageDiagnostics?.supabaseAvailable === false ? 'Supabase Storage Unavailable' : 'Supabase Primary Storage Active'}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  table: {storageDiagnostics?.tableName || 'ai_credentials'}
                </span>
              </div>
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                {storageDiagnostics?.encryptionConfigured === false
                  ? 'ENCRYPTION_SECRET is missing or too short. Credential writes are intentionally blocked until it is configured.'
                  : storageDiagnostics?.failureDetails || 'Credentials are AES-256-GCM encrypted and stored authoritatively in Supabase PostgreSQL.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 shrink-0">production-mode</span>
        </div>

        {/* Add Credential Form */}
        <form onSubmit={addCredential} className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <div className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${isDark ? 'border-slate-800 bg-slate-900/60 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Groq Cloud · Platform Managed
            </div>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Credential name (e.g. Groq Production 01)" className={`px-3.5 py-2.5 rounded-xl border text-xs outline-none ${isDark ? 'border-slate-800 bg-slate-900/60 text-slate-200 placeholder:text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400'}`} />
            <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="Groq API key (gsk_...)" autoComplete="new-password" autoCorrect="off" autoCapitalize="none" spellCheck={false} className={`px-3.5 py-2.5 rounded-xl border text-xs font-mono outline-none ${isDark ? 'border-slate-800 bg-slate-900/60 text-slate-200 placeholder:text-slate-600' : 'border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400'}`} />
          </div>
          <button type="submit" disabled={initialLoading || refreshing || adding || !apiKey.trim() || credentials.length >= (storageDiagnostics?.maxCredentials || 20)} className="mt-2.5 w-full px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-sm transition-all">
            {adding ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}<span>Add Groq API Credential</span>
          </button>
          <p className="text-[10px] text-indigo-400/80 mt-2 flex items-center gap-1">
            <Layers size={10} />
            {credentials.length >= (storageDiagnostics?.maxCredentials || 20) ? 'Maximum 20 Groq API keys reached.' : `Dedicated key pool: ${credentials.length}/${storageDiagnostics?.maxCredentials || 20}. Workload groups and models are assigned automatically by the platform.`}
          </p>
          <p className="text-[10px] text-slate-500 mt-2 flex items-center gap-1">
            <Lock size={10} className="text-slate-500" />
            API keys are submitted directly to the authenticated server, encrypted with AES-256-GCM before storage, and never returned to the client.
          </p>
        </form>

        {/* Credential List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between pb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Configured AI Credentials ({credentials.length})
            </h3>
            <span className="text-[10px] text-slate-500">Platform-assigned API slots</span>
          </div>

          {credentials.map(item => (
            <div
              key={item.id}
              className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                isDark ? 'bg-slate-900/40 border-slate-800/80 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={`text-sm font-semibold truncate ${isDark ? 'text-slate-200' : 'text-slate-900'}`}>{item.displayName}</p>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                      {item.provider || 'AI'}
                    </span>
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
                      API {String(item.priority).padStart(2, '0')}
                    </span>
                    {getHealthBadge(item)}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono text-slate-500 mt-1">
                    <span>Workload: {item.routingGroupLabel || item.routingGroup || 'Platform-managed'}</span>
                    <span>Models: 3 locked</span>
                    <span>Key: {item.maskedApiKey}</span>
                    <span>Requests: {item.totalRequests}</span>
                    <span>Failures: {item.totalFailures}</span>
                    {item.lastSuccessAt && (
                      <span title={item.lastSuccessAt}>
                        Last success: {new Date(item.lastSuccessAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 self-end sm:self-center">
                <button
                  title="Test credential health & latency"
                  onClick={() => test(item)}
                  disabled={testingId === item.id}
                  className={`p-2 rounded-lg border text-xs transition-all ${
                    isDark
                      ? 'border-slate-800 hover:bg-slate-800 text-slate-300'
                      : 'border-slate-200 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <TestTube2 size={14} className={testingId === item.id ? 'animate-spin text-indigo-400' : ''} />
                </button>

                <button
                  title={item.enabled ? 'Disable credential' : 'Enable credential'}
                  onClick={() => toggle(item)}
                  className={`p-2 rounded-lg border text-xs transition-all ${
                    item.enabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : isDark
                      ? 'border-slate-800 text-slate-500 hover:bg-slate-800'
                      : 'border-slate-200 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  <Power size={14} />
                </button>

                <button
                  title="Delete credential"
                  onClick={() => remove(item)}
                  className="p-2 rounded-lg border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-400 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}

          {initialLoading && !credentials.length && (
            <div className={`text-center py-10 rounded-xl border border-dashed p-6 ${isDark ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              <RefreshCw size={24} className="mx-auto animate-spin mb-2 text-indigo-400" />
              <p className="text-xs font-medium">Loading credentials from Supabase...</p>
            </div>
          )}

          {loadError && !credentials.length && (
            <div className={`text-center py-10 rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>
              <AlertCircle size={28} className="mx-auto text-rose-400 mb-2" />
              <p className="text-xs font-bold">Failed to load AI credentials</p>
              <p className="text-[11px] text-rose-400/80 mt-1 max-w-md mx-auto">{loadError}</p>
              <button
                type="button"
                onClick={() => load(true)}
                className="mt-3 px-4 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-all"
              >
                <RefreshCw size={12} />
                <span>Retry Loading Credentials</span>
              </button>
            </div>
          )}

          {!initialLoading && !loadError && !credentials.length && (
            <div className={`text-center py-10 rounded-xl border border-dashed p-6 ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
              <Cpu size={28} className="mx-auto opacity-40 mb-2" />
              <p className="text-xs font-medium">No AI credentials configured</p>
              <p className="text-[10px] text-slate-500 mt-1">Each API slot has a preferred workload group. The router can overflow to any healthy platform key, and model access is discovered per credential before generation.</p>
            </div>
          )}
        </div>
      </div>

      {/* Dedicated API Routing Groups */}
      <div className={`rounded-2xl border p-6 mb-6 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <Layers size={16} />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight">Dedicated API Routing Groups</h2>
              <p className="text-xs text-slate-400">Every API slot belongs to a fixed workload. Each group has exactly three server-selected models.</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">Read-Only</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {routingGroups.map((group: any) => (
            <div key={group.id} className={`rounded-xl border p-3.5 ${isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className={`text-[11px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{group.label}</p>
                  <p className="text-[9px] font-mono text-emerald-500 mt-0.5">{(group.slots || []).map((slot: number) => `API ${String(slot).padStart(2, '0')}`).join(' · ')}</p>
                </div>
                <Lock size={12} className="text-indigo-400 shrink-0" />
              </div>
              <div className="space-y-1">
                {(group.models || []).map((m: any, i: number) => (
                  <div key={`${group.id}-${m.model}-${i}`} className={`flex items-center gap-2 text-[9px] font-mono px-2 py-1 rounded-md border ${isDark ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-600'}`}>
                    <span className="w-4 h-4 rounded-full bg-indigo-500/15 text-indigo-400 flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                    <span className="truncate">{m.model}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform AI Execution Policy Card */}
      <div className={`rounded-2xl border p-6 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Lock size={16} />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-tight">Platform AI Execution Policy</h2>
              <p className="text-xs text-slate-400">Server-enforced temperature, predictable per-file defaults, model discovery, preferred API groups, overflow failover, and 20-key resilience. Administrators can manage credentials only; routing remains server-controlled.</p>
            </div>
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
            Server-Enforced · Read-Only
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">
          {Object.entries(policy?.policy || {}).map(([task, models]: any) => (
            <div
              key={task}
              className={`rounded-xl border p-3.5 flex flex-col justify-between ${
                isDark ? 'bg-slate-900/40 border-slate-800/80' : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-500/10">
                <p className={`text-[11px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  {task.replace(/_/g, ' ')}
                </p>
                <span className="text-[9px] font-mono text-slate-500">
                  {models.length} {models.length === 1 ? 'stage' : 'stages'}
                </span>
              </div>
              <div className="space-y-1.5">
                {models.map((m: any, i: number) => (
                  <div
                    key={`${m.model || 'model'}-${i}`}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-mono ${
                      isDark ? 'bg-slate-950/60 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[9px] font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="truncate">{m.model}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 shrink-0 ml-2 font-sans">
                      {m.maxOutputTokens?.toLocaleString()} max
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
