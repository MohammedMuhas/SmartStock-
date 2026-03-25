import * as React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends (React.Component as any) {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unexpected error occurred.';

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-rose-500" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
              <p className="text-slate-500 text-sm">
                We encountered an error while processing your request.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl text-left">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Error Details</p>
              <p className="text-xs font-mono text-slate-600 break-words">{errorMessage}</p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
