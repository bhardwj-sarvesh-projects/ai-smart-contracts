import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[LOCAL ERROR BOUNDARY] Caught uncaught UI component error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-300 font-sans border border-rose-900/30 rounded-xl m-2 space-y-4 text-center">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <h3 className="text-sm font-bold text-white">
              {this.props.fallbackTitle || 'Workspace Component Error'}
            </h3>
            <p className="text-xs text-slate-400">
              An unexpected rendering error occurred in this module. The rest of the workspace remains operational and your code is preserved.
            </p>
            {this.state.error && (
              <p className="text-[10px] font-mono text-rose-400/90 bg-rose-950/40 p-2 rounded border border-rose-900/30 overflow-x-auto text-left mt-2">
                {this.state.error.message || String(this.state.error)}
              </p>
            )}
          </div>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-cyan-400 px-4 py-2 rounded-lg text-xs font-semibold border border-cyan-500/20 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reload Module
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
