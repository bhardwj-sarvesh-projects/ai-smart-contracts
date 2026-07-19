import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Cpu, ArrowRight } from 'lucide-react';

interface LoginCardProps {
  onNavigate: (view: 'signup' | 'forgot_password') => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: () => void;
  isAuthenticating: boolean;
  error: string | null;
}

export default function LoginCard({
  onNavigate,
  onLogin,
  onGoogleLogin,
  isAuthenticating,
  error: apiError,
}: LoginCardProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (err) {
      // Error handled in parent state
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
          SaaS Studio
        </span>
        <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">
          Welcome back
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Sign in to your SmartContract.ai Studio account
        </p>
      </div>

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
                errors.email ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-500'
              } text-slate-900 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
              placeholder="name@company.com"
            />
          </div>
          {errors.email && (
            <p className="text-xs text-red-500 mt-1.5 font-medium flex items-center gap-1">
              <span>●</span> {errors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Password
            </label>
            <button
              type="button"
              onClick={() => onNavigate('forgot_password')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Lock size={18} />
            </span>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full pl-11 pr-11 py-3 bg-slate-50 border ${
                errors.password ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-500'
              } text-slate-900 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && (
            <p className="text-xs text-red-500 mt-1.5 font-medium flex items-center gap-1">
              <span>●</span> {errors.password}
            </p>
          )}
        </div>

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors select-none font-medium">
              Remember me
            </span>
          </label>
        </div>

        {/* API/Google Auth Error */}
        {(apiError) && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs text-center font-medium">
            {apiError}
          </div>
        )}

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
              Signing in...
            </span>
          ) : (
            <>
              Sign In
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Social Divider */}
      <div className="relative my-7">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-100" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-3.5 text-slate-400 font-semibold tracking-wider">
            Or continue with
          </span>
        </div>
      </div>

      {/* Google Sign In */}
      <button
        type="button"
        onClick={onGoogleLogin}
        disabled={isAuthenticating || isSubmitting}
        className="w-full flex items-center justify-center gap-3 px-5 py-3.5 bg-slate-50 hover:bg-slate-100/80 text-slate-700 font-semibold text-sm rounded-2xl border border-slate-200/80 focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
      >
        <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
          <path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.25.61 4.47 1.61L19.1 3.2C17.21 1.45 14.81.4 12.24.4 5.83.4.63 5.6.63 12s5.2 11.6 11.61 11.6c6.68 0 11.13-4.7 11.13-11.34 0-.76-.08-1.33-.23-1.98H12.24z" />
        </svg>
        Sign in with Google
      </button>

      {/* Switch to Sign Up */}
      <div className="mt-8 text-center text-sm text-slate-500 font-medium">
        Don't have an account?{' '}
        <button
          onClick={() => onNavigate('signup')}
          className="font-bold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
        >
          Create Account
        </button>
      </div>
    </div>
  );
}
