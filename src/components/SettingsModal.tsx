import React from 'react';
import { X, ShieldCheck, Lock, Cpu, Thermometer, Gauge } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { uid: string; email: string; displayName?: string; photoURL?: string };
  onSettingsSaved: (provider: string, model: string) => void;
  theme?: 'dark' | 'light';
}

export default function SettingsModal({ isOpen, onClose, theme = 'light' }: SettingsModalProps) {
  if (!isOpen) return null;
  const isDark = theme === 'dark';
  const panel = isDark ? 'bg-slate-950 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <div className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${panel}`}>
        <div className={`px-6 py-5 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500"><Cpu size={20} /></div>
            <div>
              <h3 className="font-bold text-lg">AI Engine</h3>
              <p className="text-xs text-slate-400">Platform-managed AI infrastructure</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-500/10"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex gap-3">
            <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-sm">AI is free and managed by AI Contracts</p>
              <p className="text-xs text-slate-400 mt-1">Your API credentials are never required or stored in your user profile.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-4 border-slate-500/10">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Lock size={11} /> Provider</p>
              <p className="mt-2 font-mono text-sm">Groq Intelligent Router</p>
            </div>
            <div className="rounded-xl border p-4 border-slate-500/10">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Lock size={11} /> Model</p>
              <p className="mt-2 font-mono text-sm">Task-selected</p>
            </div>
            <div className="rounded-xl border p-4 border-slate-500/10">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Thermometer size={11} /> Temperature</p>
              <p className="mt-2 font-mono text-sm">0.1 (locked)</p>
            </div>
            <div className="rounded-xl border p-4 border-slate-500/10">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5"><Gauge size={11} /> Output limit</p>
              <p className="mt-2 font-mono text-sm">Platform maximum</p>
            </div>
          </div>

          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs text-slate-400">
            <p className="font-semibold text-indigo-400 mb-1">Automatic failover enabled</p>
            <p>The platform automatically selects the appropriate hardcoded model for each task and moves through the configured Groq credential pool when a route fails.</p>
          </div>
        </div>

        <div className={`px-6 py-4 border-t flex justify-end ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          <button onClick={onClose} className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold">Close</button>
        </div>
      </div>
    </div>
  );
}
