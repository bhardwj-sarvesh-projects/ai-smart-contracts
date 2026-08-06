import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  CheckCircle2, 
  Loader2, 
  ShieldAlert, 
  Terminal, 
  Cpu, 
  Layers
} from 'lucide-react';

interface GenerationLoaderProps {
  isOpen: boolean;
  type: 'planning' | 'workspace';
  error: Error | string | null;
  onCloseError: () => void;
  onRetry?: () => void;
  blockchain?: string;
  language?: string;
  contractType?: string;
}

const QUALITY_GATE_STEPS = [
  { id: 'req', text: 'Analyzing Requirements...', detail: 'Deconstructing specifications, actors, business rules, and security policies.' },
  { id: 'arch', text: 'Designing Architecture...', detail: 'Structuring inheritance hierarchy, interface definitions, and storage packing.' },
  { id: 'sec', text: 'Planning Security...', detail: 'Configuring reentrancy locks, AccessControl roles, pausable state, and timelocks.' },
  { id: 'gen', text: 'Generating Enterprise Code...', detail: 'Assembling production-ready smart contract, test suite, and deployment scripts.' },
  { id: 'review', text: 'Reviewing Engineering Quality...', detail: 'Executing Quality Gate Engine static review across 10 security & quality dimensions.' },
  { id: 'opt', text: 'Optimizing Project...', detail: 'Applying custom errors, NatSpec documentation tags, and gas optimizations.' },
  { id: 'val', text: 'Validating Deployment...', detail: 'Verifying compiler compatibility, import resolution, and test suite setup.' },
  { id: 'prep', text: 'Preparing Workspace...', detail: 'Finalizing files, compiling bytecode, and initializing engineering dashboard.' },
  { id: 'ready', text: 'Project Ready.', detail: 'Quality Gate Approved (Score >= 95). Workspace loaded successfully.' }
];

const WORKSPACE_STEPS = [
  { id: 'load-ws', text: 'Loading Workspace...', detail: 'Instantiating sandboxed workspace container and database schema.' },
  { id: 'prep-contract', text: 'Preparing Smart Contract...', detail: 'Compiling generated code blocks and testing target files.' },
  { id: 'load-editor', text: 'Loading Editor...', detail: 'Injecting Monaco code templates and syntax highlighters.' },
  { id: 'finalize', text: 'Finalizing...', detail: 'Securing version histories and initiating automated project audits.' }
];

export default function GenerationLoader({
  isOpen,
  type,
  error,
  onCloseError,
  onRetry,
  blockchain = 'Ethereum',
  language = 'Solidity',
  contractType = 'Custom Contract'
}: GenerationLoaderProps) {
  const steps = type === 'planning' ? QUALITY_GATE_STEPS : WORKSPACE_STEPS;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Animate steps naturally over time
  useEffect(() => {
    if (!isOpen || error) return;

    setCurrentStepIndex(0);
    const intervalTime = type === 'planning' ? 1000 : 1200;

    const timer = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < steps.length - 1) {
          return prev + 1;
        }
        clearInterval(timer);
        return prev;
      });
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isOpen, type, error]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden select-none">
        {/* Full Screen Glass Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
        />

        {/* Content Card Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg bg-slate-900/90 border border-slate-800/80 rounded-3xl p-6 md:p-8 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden z-10"
        >
          {/* Neon Top Accent Gradient */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 opacity-80" />

          {/* Conditional Rendering: ERROR STATE vs LOADING STATE */}
          {error ? (
            <div className="space-y-6">
              {/* Error Header */}
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-2xl text-red-500 mb-4 shadow-lg shadow-red-500/5 animate-pulse">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                <span className="px-2.5 py-0.5 text-[10px] font-mono font-extrabold uppercase tracking-widest text-red-400 bg-red-500/10 rounded-full border border-red-500/20 mb-2">
                  System Exception Checked
                </span>
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Generation Interrupted
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-normal max-w-xs">
                  The AI compilation engine met an unexpected exception. Your specifications have been preserved.
                </p>
              </div>

              {/* Error Console Logs */}
              <div className="bg-slate-950/90 border border-slate-850 rounded-2xl p-4 overflow-hidden shadow-inner">
                <div className="flex items-center gap-2 border-b border-slate-850/80 pb-2 mb-2.5">
                  <Terminal className="w-4 h-4 text-red-500" />
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    Structured System Diagnostics
                  </span>
                </div>
                <div className="max-h-[220px] overflow-y-auto font-mono text-[10px] text-red-400 leading-relaxed scrollbar-thin whitespace-pre-wrap select-text space-y-1">
                  {(() => {
                    const errObj = typeof error === 'object' && error !== null ? error : { message: String(error) };
                    const rawMsg = errObj.message || String(error);
                    const stageMatch = rawMsg.match(/Stage:\s*([^\n]+)/i);
                    const engineMatch = rawMsg.match(/Engine:\s*([^\n]+)/i);
                    const funcMatch = rawMsg.match(/Function:\s*([^\n]+)/i);
                    const fileMatch = rawMsg.match(/File:\s*([^\n]+)/i);
                    const lineMatch = rawMsg.match(/Line:\s*([^\n]+)/i);
                    const reasonMatch = rawMsg.match(/Reason:\s*([^\n]+)/i);

                    const stage = stageMatch ? stageMatch[1] : 'Finalizing';
                    const engine = engineMatch ? engineMatch[1] : 'EngineeringCertificationEngine';
                    const func = funcMatch ? funcMatch[1] : 'certifyProject';
                    const file = fileMatch ? fileMatch[1] : 'EngineeringCertificationEngine.ts';
                    const line = lineMatch ? lineMatch[1] : '600';
                    const reason = reasonMatch ? reasonMatch[1] : rawMsg;

                    return (
                      <div className="space-y-1">
                        <div className="text-slate-200 font-bold border-b border-red-900/30 pb-1 mb-1">
                          Generation Interrupted
                        </div>
                        <div><span className="text-slate-400">Stage:</span> <span className="text-cyan-400 font-bold">{stage}</span></div>
                        <div><span className="text-slate-400">Engine:</span> <span className="text-amber-400 font-bold">{engine}</span></div>
                        <div><span className="text-slate-400">Function:</span> <span className="text-slate-200">{func}</span></div>
                        <div><span className="text-slate-400">File:</span> <span className="text-slate-300">{file}</span></div>
                        <div><span className="text-slate-400">Line:</span> <span className="text-slate-300">{line}</span></div>
                        <div><span className="text-slate-400">Reason:</span> <span className="text-red-300 font-medium">{reason}</span></div>
                        <div className="pt-1 border-t border-red-900/30 mt-1 flex justify-between text-[9px] text-slate-400">
                          <span>Workspace: <strong className="text-emerald-400">PRESERVED</strong></span>
                          <span>Retry: <strong className="text-cyan-400">AVAILABLE</strong></span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <button
                  onClick={onCloseError}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all border border-slate-700/50 active:scale-[0.98] cursor-pointer"
                >
                  Adjust Prompt
                </button>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-[0.98] cursor-pointer"
                  >
                    Auto-Repair & Retry
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header Animation Indicator */}
              <div className="flex items-center gap-4 border-b border-slate-800/60 pb-5">
                <div className="relative flex-shrink-0">
                  <div className="absolute inset-0 bg-cyan-500/20 rounded-2xl blur-md animate-pulse" />
                  <div className="relative p-3.5 bg-slate-950/60 border border-slate-800 rounded-2xl text-cyan-400 shadow-inner">
                    {type === 'planning' ? (
                      <Cpu className="w-6 h-6 animate-spin" style={{ animationDuration: '6s' }} />
                    ) : (
                      <Layers className="w-6 h-6 animate-pulse" />
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] font-mono font-bold text-cyan-400 uppercase tracking-widest bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                    {type === 'planning' ? 'Enterprise Quality Gate Pipeline' : 'Building Workspace'}
                  </span>
                  <h3 className="text-base font-extrabold text-white mt-1 leading-snug">
                    {type === 'planning' ? 'Executing Quality Gate Review' : 'Generating Secure Workspace'}
                  </h3>
                  <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                    Target: {blockchain} ({language}) • {contractType}
                  </p>
                </div>
              </div>

              {/* Steps Progress Checklist */}
              <div className="space-y-3">
                {steps.map((step, index) => {
                  const isCompleted = index < currentStepIndex;
                  const isActive = index === currentStepIndex;

                  return (
                    <div 
                      key={step.id} 
                      className={`flex gap-3.5 items-start transition-all duration-300 ${
                        isActive ? 'opacity-100 scale-[1.01]' : isCompleted ? 'opacity-70' : 'opacity-30'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                        ) : isActive ? (
                          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-700 bg-slate-950/40" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <span className={`text-xs font-bold block transition-colors duration-200 ${
                          isActive ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-slate-500'
                        }`}>
                          {step.text}
                        </span>
                        {isActive && (
                          <motion.p 
                            initial={{ opacity: 0, y: -2 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[10px] text-slate-400 leading-normal"
                          >
                            {step.detail}
                          </motion.p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bottom Pipeline Status Bar */}
              <div className="bg-slate-950/40 border border-slate-850/60 rounded-xl p-3 flex items-center justify-between font-mono text-[9px] text-slate-500">
                <span>Quality Gate Engine: Score Target &gt;= 95</span>
                <span className="flex items-center gap-1 text-cyan-400 font-bold">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                  Self-Evaluating
                </span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
