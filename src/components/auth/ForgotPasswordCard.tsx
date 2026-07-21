import React, { useState } from 'react';
import { Mail, Cpu, ArrowLeft, CheckCircle2, ArrowRight, HelpCircle, ShieldAlert } from 'lucide-react';
import { AuthService } from '../../firebase/authService';

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
  const [step, setStep] = useState<1 | 2>(1);
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = () => {
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

  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEmail()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const question = await AuthService.getSecurityQuestion(email);
      setSecurityQuestion(question);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'We could not find an account with that email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!securityAnswer.trim()) {
      setError('Answer is required.');
      return false;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      // 1. Verify the challenge answer
      await AuthService.verifySecurityAnswer(email, securityAnswer);
      
      // 2. If valid, trigger password reset
      await onResetSent(email);
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Incorrect security answer. Verification failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative overflow-hidden">
      {/* Centered Premium Loader Overlay */}
      {(isSubmitting || isAuthenticating) && (
        <div className="absolute inset-0 bg-white/85 backdrop-blur-md z-50 flex flex-col items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-9 w-9 text-blue-600 mb-1" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-xs font-bold text-slate-800 tracking-widest uppercase font-mono animate-pulse">
              Verifying Challenge...
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              Validating answers with BlockOnMate...
            </span>
          </div>
        </div>
      )}

      {/* Decorative Brand Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-600 mb-4 shadow-sm">
          <Cpu size={28} className="animate-pulse" />
        </div>
        <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 rounded-full border border-indigo-100 mb-2">
          Secure Identity Verification
        </span>
        <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">
          {step === 1 ? 'Reset password' : 'Answer Security Question'}
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs leading-normal">
          {step === 1 
            ? 'Verify your registered email address first to load your configured security question.' 
            : 'Enter the answer to the security challenge question below to verify your identity.'}
        </p>
      </div>

      {isSuccess ? (
        <div className="space-y-6 text-center animate-fade-in">
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl inline-flex text-emerald-600 mb-2">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Identity Verified</h3>
            <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
              We have successfully verified your identity security challenge and sent a reset link to:<br />
              <strong className="text-slate-800 font-semibold">{email}</strong>
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => onNavigate('login')}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-indigo-600/10 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all active:scale-[0.98]"
            >
              Back to Login
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : step === 1 ? (
        <form onSubmit={handleFetchQuestion} className="space-y-5" noValidate>
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
                  error ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-indigo-100 focus:border-indigo-500'
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

          {/* Continue Button */}
          <button
            type="submit"
            disabled={isSubmitting || isAuthenticating}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-indigo-600/10 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none group"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Locating Account...
              </span>
            ) : (
              <>
                Continue
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
      ) : (
        <form onSubmit={handleVerifyAndReset} className="space-y-5" noValidate>
          {/* Security Question Challenge Banner */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100/60 text-indigo-950">
            <div className="flex gap-2.5 items-start">
              <HelpCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-500 block">Security Question Challenge:</span>
                <p className="text-xs font-semibold mt-1 leading-relaxed text-slate-850">"{securityQuestion}"</p>
              </div>
            </div>
          </div>

          {/* Answer Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Your Answer
            </label>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              className={`w-full px-4 py-3 bg-slate-50 border ${
                error ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-indigo-100 focus:border-indigo-500'
              } text-slate-900 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
              placeholder="Type your security answer here..."
              required
            />
            {error && (
              <p className="text-xs text-red-500 mt-1.5 font-medium flex items-center gap-1">
                <span>●</span> {error}
              </p>
            )}
          </div>

          {/* Submit/Verify Button */}
          <button
            type="submit"
            disabled={isSubmitting || isAuthenticating}
            className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-2xl shadow-lg shadow-indigo-600/10 focus:outline-none focus:ring-4 focus:ring-indigo-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none group"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying Security Challenge...
              </span>
            ) : (
              <>
                Verify and Send Reset Link
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>

          {/* Navigation helpers */}
          <div className="pt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setSecurityAnswer('');
                setError(null);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft size={14} />
              Change Email
            </button>

            <button
              type="button"
              onClick={() => onNavigate('login')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 focus:outline-none"
            >
              Back to Login
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
