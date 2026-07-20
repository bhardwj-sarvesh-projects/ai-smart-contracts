import React, { useState } from 'react';
import { ShieldCheck, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import LoginCard from './auth/LoginCard';
import SignUpCard from './auth/SignUpCard';
import ForgotPasswordCard from './auth/ForgotPasswordCard';

interface AuthViewProps {
  onLoginSuccess: (user: any) => void;
}

export default function AuthView({ onLoginSuccess }: AuthViewProps) {
  const [view, setView] = useState<'login' | 'signup' | 'forgot_password'>('login');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, signup, forgotPassword } = useAuth();

  const handleEmailLogin = async (email: string, password: string) => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const loggedInUser = await login(email, password);
      onLoginSuccess(loggedInUser);
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleEmailSignUp = async (email: string, password: string, fullName: string, securityQuestion: string, securityAnswer: string) => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const newUser = await signup(email, password, fullName, securityQuestion, securityAnswer);
      onLoginSuccess(newUser);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
      throw err;
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleResetSent = async (email: string) => {
    setError(null);
    try {
      await forgotPassword(email);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
      throw err;
    }
  };

  return (
    <div id="auth-view" className="relative min-h-screen w-full flex items-center justify-center bg-slate-50 overflow-hidden text-slate-800">
      {/* Subtle modern vector grid background for clean SaaS feel */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-60 pointer-events-none" />

      {/* Soft blue glowing gradient in background */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Decorative Top Banner/Link for preview context */}
      <div className="absolute top-6 left-6 right-6 flex items-center justify-between pointer-events-none select-none hidden sm:flex">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest font-mono">
            AI Contracts
          </span>
        </div>
        <a 
          href="https://blockonmate.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="pointer-events-auto flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition-colors"
        >
          BlockOnMate Website
          <ArrowUpRight size={14} />
        </a>
      </div>

      {/* Form Container */}
      <div className="relative z-10 w-full max-w-lg px-6 py-12 flex flex-col items-center">
        <div className="w-full max-w-md transition-all duration-300">
          {view === 'login' && (
            <LoginCard
              onNavigate={setView}
              onLogin={handleEmailLogin}
              isAuthenticating={isAuthenticating}
              error={error}
            />
          )}

          {view === 'signup' && (
            <SignUpCard
              onNavigate={setView}
              onSignUp={handleEmailSignUp}
              isAuthenticating={isAuthenticating}
              error={error}
            />
          )}

          {view === 'forgot_password' && (
            <ForgotPasswordCard
              onNavigate={setView}
              onResetSent={handleResetSent}
              isAuthenticating={isAuthenticating}
            />
          )}
        </div>

        {/* Brand Compliance Footer */}
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <div className="flex items-center gap-2 text-xs text-slate-400 font-medium bg-white/80 border border-slate-100 rounded-full px-4 py-1.5 shadow-sm">
            <ShieldCheck size={14} className="text-blue-500" />
            <span>Secure Enterprise Authentication enabled</span>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">
            © 2026 AI Contracts. Subtitle: Powered by BlockOnMate. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
