import React, { ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught exception occurred:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
    this.setState({
      error,
      errorInfo,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleReturnToDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      const isDev = process.env.NODE_ENV !== "production" || window.location.hostname === "localhost" || window.location.hostname.includes("dev");
      
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-100 font-sans p-6">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-5">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg">
                <AlertTriangle className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white font-sans">Application Crash Detected</h1>
                <p className="text-xs text-slate-400 font-mono">Uncaught React Rendering Exception</p>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Error Message</p>
              <div className="p-4 bg-slate-950 border border-slate-850 rounded-lg text-sm text-red-400 font-mono overflow-x-auto leading-relaxed whitespace-pre-wrap">
                {this.state.error?.message || String(this.state.error)}
              </div>
            </div>

            {isDev && this.state.errorInfo?.componentStack && (
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Component Stack Trace</p>
                <div className="p-4 bg-slate-950 border border-slate-850 rounded-lg text-[11px] text-slate-300 font-mono max-h-[250px] overflow-y-auto leading-normal whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={this.handleRetry}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-sm font-semibold shadow-md transition-all cursor-pointer"
                id="error-boundary-retry-btn"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
              <button
                onClick={this.handleReturnToDashboard}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-600 rounded-lg text-sm font-semibold transition-all cursor-pointer"
                id="error-boundary-dashboard-btn"
              >
                <Home className="w-4 h-4" />
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
