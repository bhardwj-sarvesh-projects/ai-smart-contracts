import React, { useState } from 'react';
import { Mail, Cpu, ArrowLeft, CheckCircle2, ArrowRight } from 'lucide-react';

interface ForgotPasswordCardProps {
  onNavigate: (view: 'login') => void;
  onResetSent: (email: string) => Promise<void>;
  isAuthenticating: boolean;
}

export default function ForgotPasswordCard({
  onNavigate,
  onResetSent,
  isAuthenticating,
}: ForgotPasswordCardProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return false;
    }
    setError(null);
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onResetSent(email);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative overflow-hidden">
      {/* Decorative Brand Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600 mb-4 shadow-sm">
          <Cpu size={28} className="animate-pulse" />
        </div>
        <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 bg-blue-50 rounded-full border border-blue-100 mb-2">
          Password Reset
        </span>
        <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">
          Reset password
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Enter your email address and we'll send you a link to reset your password.
        </p>
      </div>

      {isSuccess ? (
        <div className="space-y-6 text-center animate-fade-in">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl inline-flex text-emerald-600 mb-2">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Check your inbox</h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              We have sent a secure password reset link to <br />
              <strong className="text-slate-800 font-semibold">{email}</strong>
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('login')}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-blue-600/10 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all active:scale-[0.98]"
            >
              Back to Login
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {/* Email Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
                <Mail size={18} />
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 bg-slate-50 border ${
                  error ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-500'
                } text-slate-900 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
                placeholder="name@company.com"
              />
            </div>
            {error && (
              <p className="text-xs text-red-500 mt-1.5 font-medium flex items-center gap-1">
                <span>●</span> {error}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || isAuthenticating}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-blue-600/10 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none group"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Sending Reset Link...
              </span>
            ) : (
              <>
                Send reset link
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          {/* Back to Login link */}
          <div className="pt-3 text-center">
            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 focus:outline-none focus:underline"
            >
              <ArrowLeft size={16} />
              Back to Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
