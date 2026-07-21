import React, { useState } from 'react';
import { Bot, ShieldAlert, CheckCircle, AlertTriangle, Info, Play, Sparkles, RefreshCw, Layers } from 'lucide-react';
import { AuditResult, ProjectFile, Vulnerability } from '../types';

interface RightAssistantProps {
  auditResult?: AuditResult;
  files: ProjectFile[];
  onApplyAIFix: (vuln: Vulnerability) => void;
  onEditContract: (instruction: string) => void;
  isProcessing: boolean;
  activeProvider: string;
  setActiveProvider: (p: string) => void;
  activeModel: string;
  setActiveModel: (m: string) => void;
}

const PROVIDERS = [
  { id: 'auto', name: '✨ Auto Select', desc: 'Chooses best model' },
  { id: 'openai', name: 'OpenAI GPT', desc: 'GPT-5.5 Enterprise' },
  { id: 'claude', name: 'Anthropic Claude', desc: 'Claude 3.5 Sonnet' },
  { id: 'deepseek', name: 'DeepSeek', desc: 'DeepSeek-V3 Coder' },
  { id: 'llama', name: 'Meta Llama', desc: 'Llama 3.1 405B' }
];

const MODELS: Record<string, string[]> = {
  auto: ['Intelligent Router'],
  openai: ['gpt-5.5', 'gpt-4o', 'o1-mini'],
  claude: ['claude-3-5-sonnet', 'claude-3-opus'],
  deepseek: ['deepseek-coder-v2', 'deepseek-chat'],
  llama: ['llama-3-70b-instruct', 'llama-3-405b']
};

export default function RightAssistant({
  auditResult,
  files,
  onApplyAIFix,
  onEditContract,
  isProcessing,
  activeProvider,
  setActiveProvider,
  activeModel,
  setActiveModel
}: RightAssistantProps) {
  const [activeTab, setActiveTab] = useState<'copilot' | 'auditor'>('copilot');
  const [editInstruction, setEditInstruction] = useState('');
  const [showProviderSettings, setShowProviderSettings] = useState(false);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInstruction.trim() || isProcessing) return;
    onEditContract(editInstruction.trim());
    setEditInstruction('');
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical': return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'high': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'low': return 'bg-yellow-500/10 text-yellow-300 border-yellow-500/10';
      default: return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-rose-400';
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800 text-slate-300 select-none">
      {/* Header Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
        <button
          onClick={() => setActiveTab('copilot')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded transition-colors ${
            activeTab === 'copilot'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          id="tab-copilot"
        >
          <Bot className="w-3.5 h-3.5" />
          AI Copilot
        </button>
        <button
          onClick={() => setActiveTab('auditor')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded transition-colors ${
            activeTab === 'auditor'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          id="tab-auditor"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Security Auditor
          {auditResult && Array.isArray(auditResult.vulnerabilities) && auditResult.vulnerabilities.length > 0 && (
            <span className="bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
              {auditResult.vulnerabilities.length}
            </span>
          )}
        </button>
      </div>

      {/* AI Assistant Settings Panel */}
      <div className="p-2.5 bg-slate-950/20 border-b border-slate-800/60 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-mono text-[11px] text-slate-400">
            Provider: <strong className="text-cyan-400 uppercase">{activeProvider}</strong> ({activeModel})
          </span>
        </div>
        <button
          onClick={() => setShowProviderSettings(!showProviderSettings)}
          className="text-[10px] text-slate-400 hover:text-cyan-400 underline transition-colors"
          id="btn-toggle-provider"
        >
          {showProviderSettings ? 'Close' : 'Configure'}
        </button>
      </div>

      {showProviderSettings && (
        <div className="p-3 bg-slate-950 border-b border-slate-800 space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Select AI Engine</label>
            <div className="grid grid-cols-2 gap-1">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProvider(p.id);
                    setActiveModel(MODELS[p.id][0]);
                  }}
                  className={`p-1.5 border rounded text-left transition-all ${
                    activeProvider === p.id
                      ? 'border-cyan-500 bg-cyan-950/20 text-white'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <p className="font-medium text-[11px] truncate">{p.name}</p>
                  <p className="text-[9px] text-slate-500 truncate">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 uppercase font-semibold">Active Model Variant</label>
            <select
              value={activeModel}
              onChange={(e) => setActiveModel(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              {(MODELS[activeProvider] || []).map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'copilot' ? (
          <div className="space-y-4 flex flex-col h-full justify-between">
            {/* Spec / Instruction Display */}
            <div className="space-y-3 flex-1">
              <div className="bg-slate-950/40 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-semibold text-slate-300">Intelligent Contract Workspace</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Enter smart contract adjustments, structural expansions, optimizations, or test instructions. 
                  The AI modifies the project files directly.
                </p>
                <div className="text-[11px] font-mono text-slate-500 bg-slate-950 p-2 rounded border border-slate-900 space-y-1">
                  <div>💡 <span className="text-slate-400">Try typing:</span></div>
                  <div>• "Add pausable functionality"</div>
                  <div>• "Convert Sol to Rust program"</div>
                  <div>• "Use Roles instead of Ownable"</div>
                  <div>• "Inject SafeMath validation checks"</div>
                </div>
              </div>

              {isProcessing && (
                <div className="flex items-center gap-2 justify-center p-4 bg-slate-950/60 border border-cyan-500/20 rounded-lg text-xs font-mono text-cyan-400 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  AI Architect is generating...
                </div>
              )}
            </div>

            {/* Prompt Input Form */}
            <form onSubmit={handleEditSubmit} className="mt-auto space-y-2">
              <div className="relative">
                <textarea
                  value={editInstruction}
                  onChange={(e) => setEditInstruction(e.target.value)}
                  placeholder="Ask AI to modify, optimize, rewrite or append functionality..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
                  disabled={isProcessing}
                />
              </div>
              <button
                type="submit"
                disabled={isProcessing || !editInstruction.trim()}
                className="w-full bg-gradient-to-r from-cyan-600 to-indigo-600 text-white rounded-lg py-2 text-xs font-semibold hover:from-cyan-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none"
                id="btn-submit-edit"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Refactor Workspace
              </button>
            </form>
          </div>
        ) : (
          /* SECURITY AUDITOR TAB */
          <div className="space-y-4">
            {auditResult ? (
              <div className="space-y-4">
                {/* Stats Bento Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950/30 border border-slate-800 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Security Score</p>
                    <p className={`text-2xl font-bold font-mono mt-0.5 ${getScoreColor(auditResult.score)}`}>
                      {auditResult.score}/100
                    </p>
                  </div>
                  <div className="bg-slate-950/30 border border-slate-800 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Code Quality</p>
                    <p className="text-2xl font-bold font-mono text-cyan-400 mt-0.5">
                      {auditResult.codeQuality}%
                    </p>
                  </div>
                  <div className="bg-slate-950/30 border border-slate-800 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Gas Efficiency</p>
                    <p className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">
                      {auditResult.gasOptimization}%
                    </p>
                  </div>
                  <div className="bg-slate-950/30 border border-slate-800 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Complexity Metric</p>
                    <p className="text-2xl font-bold font-mono text-purple-400 mt-0.5">
                      {auditResult.complexity}/10
                    </p>
                  </div>
                </div>

                {/* Audit summary */}
                <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-3 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Audit Overview</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{auditResult.summary}</p>
                </div>

                {/* Vulnerabilities List */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vulnerability Logs</p>
                  {(!auditResult.vulnerabilities || !Array.isArray(auditResult.vulnerabilities) || auditResult.vulnerabilities.length === 0) ? (
                    <div className="flex flex-col items-center justify-center p-6 bg-emerald-950/10 border border-emerald-500/20 rounded-lg text-center text-emerald-400">
                      <CheckCircle className="w-8 h-8 mb-2" />
                      <p className="text-xs font-semibold">Pristine Security Posture</p>
                      <p className="text-[10px] text-slate-500 mt-1">No vulnerabilities identified in active scope.</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {auditResult.vulnerabilities.map((v) => (
                        <div
                          key={v.id}
                          className="bg-slate-950/40 border border-slate-800 rounded-lg p-3 space-y-2 hover:border-slate-700 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${getSeverityColor(v.severity)}`}>
                              {v.severity}
                            </span>
                            {v.line && v.file && (
                              <span className="text-[10px] font-mono text-slate-500">
                                Line {v.line} in {String(v.file).split('/').pop()}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-white">{v.title}</p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{v.description}</p>
                          <div className="bg-slate-950 p-2 rounded border border-slate-900">
                            <p className="text-[9px] text-slate-500 uppercase font-semibold mb-0.5">Recommendation:</p>
                            <p className="text-[11px] text-slate-300 font-mono">{v.recommendation}</p>
                          </div>
                          {v.fixAvailable && (
                            <button
                              onClick={() => onApplyAIFix(v)}
                              disabled={isProcessing}
                              className="w-full flex items-center justify-center gap-1.5 bg-cyan-900/30 hover:bg-cyan-900/50 border border-cyan-500/30 text-cyan-300 rounded py-1.5 text-xs font-medium transition-all"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              One-Click AI Security Fix
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 bg-slate-950/30 border border-slate-800 rounded-lg text-center text-slate-500">
                <ShieldAlert className="w-10 h-10 mb-2 text-slate-600" />
                <p className="text-xs font-semibold text-slate-400">Security Audit Not Executed</p>
                <p className="text-[10px] text-slate-600 mt-1 max-w-[200px] leading-relaxed">
                  Generate a contract or click 'Audit Codebase' to verify security guarantees.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
