import React from 'react';
import { RefreshCw, RotateCcw, Sparkles } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  resetCount: number;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      resetCount: 0,
    };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[SugarPop ErrorBoundary] Unexpected rendering error:', error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState((prev) => ({
      hasError: false,
      resetCount: prev.resetCount + 1,
    }));
  };

  private handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full bg-[#120a1f] flex items-center justify-center p-4 text-white select-none">
          <div
            role="alert"
            className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-[#3f145f] via-[#240a3d] to-[#130423] border-4 border-[#ff77aa]/80 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-center overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-pink-500/20 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-amber-400/15 blur-2xl pointer-events-none" />

            <div className="relative mx-auto mb-4 w-14 h-14 rounded-2xl bg-pink-500/20 border border-pink-400/40 flex items-center justify-center text-amber-300 shadow-inner">
              <Sparkles className="w-7 h-7" />
            </div>

            <h1 className="text-2xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-orange-300">
              SUGAR POP
            </h1>
            <p className="mt-2 text-sm font-bold text-pink-200">
              Oops! A candy tangle interrupted the board.
            </p>
            <p className="mt-1.5 text-xs text-white/70 leading-relaxed">
              Your saved level progress and settings are safe. Try resuming or reload the game.
            </p>

            <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={this.handleRetry}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-gradient-to-b from-[#ffe542] via-[#ff9b00] to-[#e64700] border border-[#fff799]/80 text-sm font-black text-white shadow-lg active:translate-y-0.5 transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-bold text-white active:scale-95 transition-all cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return <React.Fragment key={this.state.resetCount}>{this.props.children}</React.Fragment>;
  }
}
