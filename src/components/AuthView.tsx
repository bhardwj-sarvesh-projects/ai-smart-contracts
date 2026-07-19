import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthViewProps {
  onLoginSuccess: (user: any) => void;
}

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div id="auth-view" className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 overflow-hidden text-slate-100">
      {/* Decorative cosmic background glow effects */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Decorative subtle stars overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* Auth Card Container */}
      <div className="relative z-10 w-full max-w-md px-6 py-12">
        <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden transition duration-500 hover:border-slate-700/80">
          {/* Top border glowing gradient */}
          <div className="absolute top-0 inset-x-0 h-[1px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

          {/* Logo Area */}
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400 relative z-10 animate-pulse">
                <Cpu size={32} />
              </div>
              <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl filter blur-xl opacity-50 scale-110 pointer-events-none" />
            </div>

            <div>
              <div className="flex items-center justify-center gap-1.5">
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                  Version 2.0
                </span>
              </div>
              <h1 className="font-sans font-bold text-2xl mt-3 tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
                SmartContract.ai Studio
              </h1>
              <p className="text-sm text-slate-400 mt-2 max-w-xs leading-relaxed">
                Professional Multi-AI Compiler, Auditor, & Generative Workspace
              </p>
            </div>
          </div>

          {/* Interactive login button */}
          <div className="mt-10 space-y-4">
            <button
              id="google-signin-btn"
              type="button"
              onClick={handleGoogleLogin}
              disabled={isAuthenticating}
              className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-indigo-600/15 border border-indigo-500/50 hover:border-indigo-400 focus:outline-none transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none group"
            >
              {isAuthenticating ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Establishing Secure Session...
                </span>
              ) : (
                <>
                  <svg className="w-4 h-4 fill-current text-white" viewBox="0 0 24 24">
                    <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.61 4.47 1.61L19.1 3.2C17.21 1.45 14.81.4 12.24.4 5.83.4.63 5.6.63 12s5.2 11.6 11.61 11.6c6.68 0 11.13-4.7 11.13-11.34 0-.76-.08-1.33-.23-1.98H12.24z" />
                  </svg>
                  Continue with Google Login
                  <ArrowRight size={15} className="ml-0.5 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            {/* Error messaging */}
            {error && (
              <div id="auth-error" className="p-3 bg-rose-500/5 border border-rose-500/20 rounded-xl text-rose-300 text-xs text-center animate-shake">
                {error}
              </div>
            )}
          </div>

          {/* Trust/Compliance footer inside the card */}
          <div className="mt-8 pt-6 border-t border-slate-800/60 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-medium">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Encrypted cloud session secured by AES-256</span>
          </div>
        </div>

        {/* Minimal outer tagline */}
        <p className="text-center text-[11px] text-slate-600 mt-6 tracking-wide uppercase font-semibold">
          Crafted for Enterprise Smart Contract Engineering
        </p>
      </div>
    </div>
  );
}
