import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, CircleAlert, Lock, Plus, RefreshCw, ShieldCheck, Trash2, Power, TestTube2 } from 'lucide-react';

interface Credential {
  id: string;
  displayName: string;
  maskedApiKey: string;
  enabled: boolean;
  priority: number;
  healthStatus: string;
  cooldownUntil?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  totalRequests: number;
  totalFailures: number;
}

interface Props {
  authedFetch: (url: string, options?: RequestInit) => Promise<Response>;
  theme: 'dark' | 'light';
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function AdminAIInfrastructure({ authedFetch, theme, showToast }: Props) {
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [policy, setPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [adding, setAdding] = useState(false);
  const isDark = theme === 'dark';

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        authedFetch('/api/admin/ai/credentials'),
        authedFetch('/api/admin/ai/policy')
      ]);
      if (!cRes.ok || !pRes.ok) throw new Error('Unable to load AI infrastructure.');
      const c = await cRes.json();
      const p = await pRes.json();
      setCredentials(c.credentials || []);
      setPolicy(p);
    } catch (e: any) {
      showToast?.(e.message || 'AI infrastructure loading failed.', 'error');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addCredential = async () => {
    if (!apiKey.trim()) return;
    setAdding(true);
    try {
      const res = await authedFetch('/api/admin/ai/credentials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, apiKey: apiKey.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add credential.');
      setDisplayName(''); setApiKey('');
      showToast?.('Groq credential added securely.', 'success');
      await load();
    } catch (e: any) { showToast?.(e.message || 'Failed to add credential.', 'error'); }
    finally { setAdding(false); }
  };

  const toggle = async (item: Credential) => {
    const res = await authedFetch(`/api/admin/ai/credentials/${item.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !item.enabled })
    });
    if (res.ok) await load();
    else showToast?.('Failed to change credential status.', 'error');
  };

  const remove = async (item: Credential) => {
    if (!window.confirm(`Delete ${item.displayName}? This cannot be undone.`)) return;
    const res = await authedFetch(`/api/admin/ai/credentials/${item.id}`, { method: 'DELETE' });
    if (res.ok) { showToast?.('Credential deleted.', 'success'); await load(); }
    else showToast?.('Failed to delete credential.', 'error');
  };

  const test = async (item: Credential) => {
    const res = await authedFetch(`/api/admin/ai/credentials/${item.id}/test`, { method: 'POST' });
    const data = await res.json();
    showToast?.(data.success ? `Credential healthy (${data.latencyMs}ms).` : (data.error || 'Credential test failed.'), data.success ? 'success' : 'error');
    await load();
  };

  return (
    <div className="space-y-6">
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-500" size={20} /><h2 className="font-bold">AI Infrastructure</h2></div>
            <p className="text-xs text-slate-400 mt-1">Admin-controlled Groq credentials with automatic task/model failover.</p>
          </div>
          <button onClick={load} className="p-2 rounded-lg border border-slate-500/20 hover:bg-slate-500/10"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /></button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-slate-500/10 p-3"><p className="text-[10px] text-slate-400 uppercase">Credentials</p><p className="text-xl font-bold mt-1">{credentials.length}</p></div>
          <div className="rounded-xl border border-slate-500/10 p-3"><p className="text-[10px] text-slate-400 uppercase">Enabled</p><p className="text-xl font-bold mt-1 text-emerald-500">{credentials.filter(c => c.enabled).length}</p></div>
          <div className="rounded-xl border border-slate-500/10 p-3"><p className="text-[10px] text-slate-400 uppercase">Temperature</p><p className="text-xl font-bold mt-1">{policy?.temperature ?? 0.1}</p></div>
          <div className="rounded-xl border border-slate-500/10 p-3"><p className="text-[10px] text-slate-400 uppercase">Global Max</p><p className="text-xl font-bold mt-1">{policy?.globalMaxOutputTokens ?? 65536}</p></div>
        </div>

        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-2 mb-5">
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Credential name (e.g. Groq Production 01)" className="px-3 py-2 rounded-xl border border-slate-500/20 bg-transparent text-xs outline-none" />
          <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="gsk_••••••••••" className="px-3 py-2 rounded-xl border border-slate-500/20 bg-transparent text-xs font-mono outline-none" />
          <button disabled={adding || !apiKey.trim()} onClick={addCredential} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"><Plus size={14} /> Add</button>
        </div>

        <div className="space-y-2">
          {credentials.map(item => (
            <div key={item.id} className="rounded-xl border border-slate-500/10 p-3 flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full ${item.enabled && item.healthStatus === 'healthy' ? 'bg-emerald-500' : item.enabled ? 'bg-amber-500' : 'bg-slate-500'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><p className="text-sm font-semibold truncate">{item.displayName}</p><span className="text-[9px] uppercase text-slate-400">Priority {item.priority}</span></div>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">{item.maskedApiKey} · {item.healthStatus}</p>
                <p className="text-[9px] text-slate-500 mt-1">Requests {item.totalRequests} · Failures {item.totalFailures}</p>
              </div>
              <button title="Test" onClick={() => test(item)} className="p-2 rounded-lg hover:bg-slate-500/10"><TestTube2 size={14} /></button>
              <button title={item.enabled ? 'Disable' : 'Enable'} onClick={() => toggle(item)} className="p-2 rounded-lg hover:bg-slate-500/10">{item.enabled ? <Power size={14} className="text-emerald-500" /> : <Power size={14} className="text-slate-500" />}</button>
              <button title="Delete" onClick={() => remove(item)} className="p-2 rounded-lg hover:bg-rose-500/10 text-rose-500"><Trash2 size={14} /></button>
            </div>
          ))}
          {!credentials.length && <div className="text-center py-8 text-xs text-slate-500">No Groq credentials configured. Add the first credential above.</div>}
        </div>
      </div>

      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-2 mb-4"><Lock size={16} className="text-indigo-500" /><h2 className="font-bold">Locked Model Policy</h2></div>
        <p className="text-xs text-slate-400 mb-4">These model assignments are hardcoded in the server and cannot be changed from this panel.</p>
        <div className="space-y-2">
          {Object.entries(policy?.policy || {}).map(([task, models]: any) => (
            <div key={task} className="rounded-xl border border-slate-500/10 p-3">
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">{task.replace(/_/g, ' ')}</p>
              <div className="flex flex-wrap gap-2">{models.map((m: any, i: number) => <span key={m.model} className="px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-mono"><b>{i + 1}.</b> {m.model}</span>)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
