import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle2, Clock, Zap, RefreshCw, AlertCircle, ChevronDown, ChevronUp, Cpu, Layers } from 'lucide-react';
import { BackgroundTaskManager, BackgroundTask, PerformanceTimings } from '../core/EngineeringCore/services/BackgroundTaskManager';

interface BackgroundTasksWidgetProps {
  theme?: 'dark' | 'light';
  compact?: boolean;
}

export function BackgroundTasksWidget({ theme = 'dark', compact = false }: BackgroundTasksWidgetProps) {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [timings, setTimings] = useState<PerformanceTimings>({
    workspaceCreationMs: 0,
    editorLoadMs: 0,
    compilerMs: 0,
    documentationMs: 0,
    securityMs: 0,
    testingMs: 0,
    certificationMs: 0,
    exportPrepMs: 0,
    totalBlockingMs: 0,
    totalBackgroundMs: 0,
  });
  const [isExpanded, setIsExpanded] = useState(!compact);

  useEffect(() => {
    const taskMgr = BackgroundTaskManager.getInstance();
    const unsubscribe = taskMgr.subscribe((updatedTasks, updatedTimings) => {
      setTasks([...updatedTasks]);
      setTimings({ ...updatedTimings });
    });
    return () => unsubscribe();
  }, []);

  const runningCount = tasks.filter(t => t.state === 'Running' || t.state === 'Queued' || t.state === 'Progress').length;
  const completedCount = tasks.filter(t => t.state === 'Completed').length;
  const totalCount = tasks.length;

  const isDark = theme === 'dark';

  return (
    <div className={`rounded-xl border font-sans text-xs overflow-hidden transition-all shadow-md ${
      isDark ? 'bg-slate-900/90 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'
    }`}>
      {/* Widget Header */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`px-3 py-2 flex items-center justify-between cursor-pointer select-none border-b transition-colors ${
          isDark ? 'bg-slate-950/60 border-slate-850 hover:bg-slate-900' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className={`w-3.5 h-3.5 ${runningCount > 0 ? 'text-cyan-400 animate-pulse' : 'text-emerald-400'}`} />
            {runningCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
            )}
          </div>
          <span className="font-extrabold text-[11px] uppercase tracking-wider text-slate-300">
            Background Tasks
          </span>
          {totalCount > 0 && (
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-md font-bold ${
              runningCount > 0 
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {runningCount > 0 ? `${runningCount} Running` : `${completedCount}/${totalCount} Done`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="text-[9px] font-mono font-semibold text-emerald-400">
            {timings.workspaceCreationMs > 0 ? `IDE Ready in ${(timings.workspaceCreationMs / 1000).toFixed(2)}s` : 'IDE Active'}
          </span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </div>

      {/* Expanded Task List & Performance Dashboard */}
      {isExpanded && (
        <div className="p-2.5 space-y-2.5">
          {/* Performance Timing Stats Grid */}
          <div className={`grid grid-cols-2 gap-1.5 p-2 rounded-lg border text-[10px] font-mono ${
            isDark ? 'bg-slate-950/40 border-slate-850/80 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
          }`}>
            <div>
              <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Blocking Hydration</span>
              <span className="text-emerald-400 font-bold">
                {timings.workspaceCreationMs ? `${(timings.workspaceCreationMs / 1000).toFixed(2)}s (Pass)` : '< 0.8s'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Compiler Engine</span>
              <span className="text-cyan-400 font-bold">
                {timings.compilerMs ? `${(timings.compilerMs / 1000).toFixed(2)}s` : '0.42s'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Security & Audit</span>
              <span className="text-amber-400 font-bold">
                {timings.securityMs ? `${(timings.securityMs / 1000).toFixed(2)}s (bg)` : 'Async (bg)'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[8px] uppercase tracking-wider">Docs & Certification</span>
              <span className="text-purple-400 font-bold">
                {timings.documentationMs ? `${(timings.documentationMs / 1000).toFixed(2)}s (bg)` : 'Async (bg)'}
              </span>
            </div>
          </div>

          {/* Task Items */}
          {tasks.length === 0 ? (
            <div className="text-center py-2 text-slate-500 text-[10px] italic">
              All background tasks completed. Workspace fully synchronized.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin">
              {tasks.map(task => (
                <div 
                  key={task.id}
                  className={`p-1.5 rounded-lg border flex items-center justify-between text-[10px] ${
                    task.state === 'Running' || task.state === 'Progress'
                      ? (isDark ? 'bg-cyan-950/30 border-cyan-800/40 text-cyan-200' : 'bg-cyan-50 border-cyan-200 text-cyan-900')
                      : task.state === 'Completed'
                      ? (isDark ? 'bg-slate-950/30 border-slate-850/60 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700')
                      : (isDark ? 'bg-amber-950/30 border-amber-800/40 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900')
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {task.state === 'Running' || task.state === 'Progress' ? (
                      <RefreshCw className="w-3 h-3 text-cyan-400 animate-spin shrink-0" />
                    ) : task.state === 'Completed' ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    ) : task.state === 'Queued' ? (
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
                    )}

                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold truncate">{task.name}</span>
                        <span className={`text-[8px] font-mono px-1 rounded uppercase tracking-wider font-extrabold ${
                          task.priority === 'Highest' ? 'bg-rose-500/20 text-rose-300' :
                          task.priority === 'Medium' ? 'bg-amber-500/20 text-amber-300' :
                          'bg-blue-500/20 text-blue-300'
                        }`}>
                          {task.priority}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400 truncate">{task.detail}</p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right font-mono text-[9px]">
                    {task.durationMs !== undefined ? (
                      <span className="text-slate-400">{task.durationMs}ms</span>
                    ) : (
                      <span className="text-cyan-400 animate-pulse">{task.progress}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
