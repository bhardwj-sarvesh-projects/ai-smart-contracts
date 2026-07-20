import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Cpu, ArrowRight, User, HelpCircle } from 'lucide-react';

interface SignUpCardProps {
  onNavigate: (view: 'login') => void;
  onSignUp: (email: string, password: string, fullName: string, securityQuestion: string, securityAnswer: string) => Promise<void>;
  isAuthenticating: boolean;
  error: string | null;
}

const SECURITY_QUESTIONS = [
  "What is your childhood best friend's name?",
  "What was your childhood nickname?",
  "What is your mother's maiden name?",
  "What is the name of your first pet?",
  "In what city or town did your parents meet?"
];

export default function SignUpCard({
  onNavigate,
  onSignUp,
  isAuthenticating,
  error: apiError,
}: SignUpCardProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    securityAnswer?: string;
    agreeTerms?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = () => {
    const newErrors: typeof errors = {};
    if (!name.trim()) {
      newErrors.name = 'Full name is required';
    }
    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (confirmPassword !== password) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    if (!securityAnswer.trim()) {
      newErrors.securityAnswer = 'Security answer is required';
    }
    if (!agreeTerms) {
      newErrors.agreeTerms = 'You must agree to the Terms of Service';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      await onSignUp(email, password, name, securityQuestion, securityAnswer);
    } catch (err) {
      // Handled in parent state
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.04)] relative overflow-hidden">
      {/* Decorative Brand Header */}
      <div className="flex flex-col items-center text-center mb-8">
        <div className="mb-4">
          <img src="https://blockonmate.com/blockonmate-logo.png" alt="BlockOnMate Logo" className="h-14 w-auto drop-shadow-md" referrerPolicy="no-referrer" />
        </div>
        <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-blue-600 bg-blue-50 rounded-full border border-blue-100 mb-2">
          AI Contracts
        </span>
        <h2 className="text-2xl font-bold font-sans text-slate-900 tracking-tight">
          Create an account
        </h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Powered by BlockOnMate
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Name Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Full Name
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <User size={18} />
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 bg-slate-50 border ${
                errors.name ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-500'
              } text-slate-900 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
              placeholder="John Doe"
            />
          </div>
          {errors.name && (
            <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
              <span>●</span> {errors.name}
            </p>
          )}
        </div>

        {/* Email Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
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
            <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
              <span>●</span> {errors.email}
            </p>
          )}
        </div>

        {/* Password Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Password
          </label>
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
              placeholder="Min. 8 characters"
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
            <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
              <span>●</span> {errors.password}
            </p>
          )}
        </div>

        {/* Confirm Password Field */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <Lock size={18} />
            </span>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={`w-full pl-11 pr-11 py-3 bg-slate-50 border ${
                errors.confirmPassword ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-500'
              } text-slate-900 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
              placeholder="Confirm password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
              <span>●</span> {errors.confirmPassword}
            </p>
          )}
        </div>

        {/* Security Question dropdown */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Security Question (For Password Recovery)
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <HelpCircle size={18} />
            </span>
            <select
              value={securityQuestion}
              onChange={(e) => setSecurityQuestion(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 text-slate-900 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all cursor-pointer"
            >
              {SECURITY_QUESTIONS.map((q, i) => (
                <option key={i} value={q}>{q}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Security Answer input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Security Question Answer
          </label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 pointer-events-none">
              <HelpCircle size={18} />
            </span>
            <input
              type="text"
              value={securityAnswer}
              onChange={(e) => setSecurityAnswer(e.target.value)}
              className={`w-full pl-11 pr-4 py-3 bg-slate-50 border ${
                errors.securityAnswer ? 'border-red-400 focus:ring-red-100 focus:border-red-500' : 'border-slate-200 focus:ring-blue-100 focus:border-blue-500'
              } text-slate-900 rounded-2xl text-sm placeholder-slate-400 focus:outline-none focus:ring-4 transition-all`}
              placeholder="Your answer (case insensitive)"
            />
          </div>
          {errors.securityAnswer && (
            <p className="text-xs text-red-500 mt-1 font-medium flex items-center gap-1">
              <span>●</span> {errors.securityAnswer}
            </p>
          )}
        </div>

        {/* Terms and Conditions Checkbox */}
        <div className="pt-1">
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
            />
            <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors select-none font-medium leading-relaxed">
              I agree to the{' '}
              <a href="#" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="#" className="font-bold text-blue-600 hover:text-blue-700 hover:underline">
                Privacy Policy
              </a>
            </span>
          </label>
          {errors.agreeTerms && (
            <p className="text-xs text-red-500 mt-1.5 font-medium flex items-center gap-1">
              <span>●</span> {errors.agreeTerms}
            </p>
          )}
        </div>

        {/* API Error */}
        {apiError && (
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
              Creating Account...
            </span>
          ) : (
            <>
              Create Account
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </>
          )}
        </button>
      </form>

      {/* Switch to Sign In */}
      <div className="mt-8 text-center text-sm text-slate-500 font-medium">
        Already have an account?{' '}
        <button
          onClick={() => onNavigate('login')}
          className="font-bold text-blue-600 hover:text-blue-700 focus:outline-none focus:underline"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
