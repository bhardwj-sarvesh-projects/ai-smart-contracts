import React, { useState, useEffect } from 'react';
import { X, Shield, Key, Sliders, Check, AlertTriangle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { AppUser } from '../lib/firebase';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AppUser;
  onSettingsSaved: (provider: string, model: string) => void;
  theme?: 'dark' | 'light';
}

export default function SettingsModal({ isOpen, onClose, currentUser, onSettingsSaved, theme = 'light' }: SettingsModalProps) {
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(2000);

  const [models, setModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showKey, setShowKey] = useState(false);

  // Testing & Save states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load settings on open
  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  // Load models whenever provider or api key changes
  useEffect(() => {
    if (isOpen) {
      fetchModels(provider, apiKey);
    }
  }, [provider]);

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/settings', {
        headers: {
          'x-user-id': currentUser.uid,
          'x-user-email': currentUser.email,
          'x-user-name': currentUser.displayName,
          'x-user-photo': currentUser.photoURL
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProvider(data.provider || 'openai');
        setApiKey(data.apiKey || '');
        setModel(data.defaultModel || '');
        setTemperature(data.temperature ?? 0.2);
        setMaxTokens(data.maxTokens ?? 2000);

        // Fetch models for loaded credentials
        fetchModels(data.provider || 'openai', data.apiKey || '');
      }
    } catch (err) {
      console.error('Failed to load user settings', err);
    }
  };

  const fetchModels = async (targetProvider: string, targetKey: string) => {
    setIsLoadingModels(true);
    try {
      const res = await fetch('/api/settings/models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.uid,
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({ provider: targetProvider, apiKey: targetKey })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.models)) {
          setModels(data.models);
          // If loaded model is not in new list, pick first or keep
          if (!data.models.includes(model)) {
            setModel(data.models[0] || '');
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch models dynamically', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.uid,
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          provider,
          apiKey,
          defaultModel: model,
          temperature,
          maxTokens
        })
      });
      const data = await res.json();
      if (data.success && data.connected) {
        setTestResult({ success: true, latency: data.latency });
      } else {
        setTestResult({ success: false, error: data.error || 'Connection failed' });
      }
    } catch (err: any) {
      setTestResult({ success: false, error: err.message || 'Network error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.uid,
          'x-user-email': currentUser.email
        },
        body: JSON.stringify({
          provider,
          apiKey,
          defaultModel: model,
          temperature,
          maxTokens
        })
      });
      if (res.ok) {
        setSaveSuccess(true);
        onSettingsSaved(provider, model);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error('Failed to save settings', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  return (
    <div id="settings-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-opacity duration-300">
      <div className={`w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden backdrop-blur-xl animate-fade-in transition-colors duration-300 ${
        isDark ? 'bg-slate-950/90 border-slate-850 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b transition-colors duration-300 ${
          isDark ? 'border-slate-850 bg-slate-900/40' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500 dark:text-indigo-400">
              <Sliders size={20} />
            </div>
            <div>
              <h3 className={`font-sans font-semibold text-lg ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>AI Engine Orchestrator</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500">Configure providers, credentials, and deployment models</p>
            </div>
          </div>
          <button 
            id="close-settings-btn"
            onClick={onClose} 
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-800'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Provider Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Shield size={12} className="text-indigo-500 dark:text-indigo-400" /> AI Service Provider
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'openai', name: 'OpenAI', desc: 'GPT Series (gpt-4o, gpt-4o-mini)' },
                { id: 'groq', name: 'GroqCloud', desc: 'Ultra-low Latency (Llama 3.3)' }
              ].map((p) => (
                <button
                  id={`provider-btn-${p.id}`}
                  key={p.id}
                  type="button"
                  onClick={() => setProvider(p.id)}
                  className={`p-3 text-left border rounded-xl transition cursor-pointer ${
                    provider === p.id
                      ? 'border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-white shadow-lg shadow-indigo-500/5 font-bold'
                      : isDark
                      ? 'border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-700'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <label className="text-xs font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Key size={12} className="text-indigo-500 dark:text-indigo-400" /> API Access Key
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 normal-case font-medium">Never exposed or logged</span>
            </label>
            <div className="relative">
              <input
                id="api-key-input"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={apiKey ? "••••••••" : `Enter your ${provider.toUpperCase()} API key...`}
                className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none transition pr-10 font-mono ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 hover:border-slate-700 focus:border-indigo-500 text-slate-100 placeholder-slate-600'
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300 focus:border-indigo-500 text-slate-900 placeholder-slate-400'
                }`}
              />
              <button
                id="toggle-key-visibility-btn"
                type="button"
                onClick={() => setShowKey(!showKey)}
                className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                  isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Dynamic Model Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500 flex items-center justify-between">
              <span>Selected Deployment Model</span>
              {isLoadingModels && <RefreshCw size={12} className="animate-spin text-indigo-500" />}
            </label>
            <select
              id="model-select"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none transition cursor-pointer ${
                isDark
                  ? 'bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-100 focus:border-indigo-500'
                  : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-900 focus:border-indigo-500'
              }`}
              disabled={isLoadingModels}
            >
              {isLoadingModels ? (
                <option>Loading optimal models...</option>
              ) : models.length > 0 ? (
                models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))
              ) : (
                <option>No models found</option>
              )}
            </select>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 dark:text-slate-500">
                <span className="tracking-wide uppercase">Temperature</span>
                <span className="font-mono text-indigo-500 dark:text-indigo-400 font-bold">{temperature}</span>
              </div>
              <input
                id="temperature-range"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-slate-200 dark:bg-slate-800 h-1 rounded-lg cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold tracking-wide uppercase text-slate-400 dark:text-slate-500 block">
                Max Generation Tokens
              </label>
              <input
                id="max-tokens-input"
                type="number"
                min="256"
                max="16384"
                step="256"
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className={`w-full px-4 py-2 border rounded-xl text-sm focus:outline-none font-mono ${
                  isDark
                    ? 'bg-slate-900 border-slate-800 text-slate-100 focus:border-indigo-500'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'
                }`}
              />
            </div>
          </div>

          {/* Test Status Feedback */}
          {testResult && (
            <div id="test-connection-result" className={`p-4 rounded-xl border ${
              testResult.success 
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-300' 
                : 'bg-rose-500/5 border-rose-500/20 text-rose-600 dark:text-rose-300'
            } flex items-start gap-3 text-sm animate-fade-in`}>
              {testResult.success ? (
                <>
                  <Check size={18} className="text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Connection Secured</p>
                    <p className="text-xs text-emerald-500/80 dark:text-emerald-400/80 mt-0.5">Verified endpoint with latency of {testResult.latency}ms.</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertTriangle size={18} className="text-rose-500 dark:text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold">Verification Failed</p>
                    <p className="text-xs text-rose-500/80 dark:text-rose-400/80 mt-0.5">{testResult.error}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className={`px-6 py-4 border-t flex items-center justify-between transition-colors duration-300 ${
          isDark ? 'border-slate-850 bg-slate-900/20' : 'border-slate-200 bg-slate-50/50'
        }`}>
          <button
            id="test-connection-btn"
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || isLoadingModels}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border transition-all disabled:opacity-40 cursor-pointer ${
              isDark
                ? 'text-slate-300 hover:text-white border-slate-800 hover:border-slate-700 hover:bg-slate-900/60'
                : 'text-slate-700 hover:text-slate-900 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
            }`}
          >
            {isTesting ? <RefreshCw size={13} className="animate-spin" /> : null}
            Test Connection
          </button>

          <div className="flex items-center space-x-3">
            <button
              id="cancel-settings-btn"
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Cancel
            </button>
            <button
              id="save-settings-btn"
              type="button"
              onClick={handleSave}
              disabled={isSaving || saveSuccess}
              className={`px-5 py-2 text-xs font-semibold rounded-xl transition shadow-lg cursor-pointer ${
                saveSuccess 
                  ? 'bg-emerald-500 text-white shadow-emerald-500/10' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/10 disabled:opacity-40'
              }`}
            >
              {isSaving ? 'Encrypting & Saving...' : saveSuccess ? 'Saved successfully!' : 'Apply Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
