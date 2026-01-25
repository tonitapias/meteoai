// src/components/ErrorBoundary.tsx
import React, { ReactNode } from 'react';
import * as Sentry from "@sentry/react"; 
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 1. Log a consola local
    console.error("Error capturat al component:", error, errorInfo);
    
    // 2. Enviar informe a Sentry amb el 'stack trace' de React
    Sentry.captureException(error, { 
        contexts: { react: { componentStack: errorInfo.componentStack } } 
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[150px] p-6 rounded-3xl bg-rose-500/5 border border-rose-500/10 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-center animate-in fade-in zoom-in-95 duration-500">
           <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)]">
              <AlertTriangle className="w-6 h-6" />
           </div>
           
           <div className="flex flex-col gap-1">
              <h3 className="text-xs font-black text-rose-200 uppercase tracking-widest">Error de Sistema</h3>
              {/* CORRECCIÓ: 's'ha' -> 's&apos;ha' per evitar error de linter */}
              <p className="text-[10px] text-rose-300/70 font-mono">No s&apos;ha pogut renderitzar aquest mòdul.</p>
           </div>

           <button 
             onClick={() => this.setState({ hasError: false })}
             className="flex items-center gap-2 px-4 py-2 mt-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer"
           >
             <RefreshCw className="w-3 h-3" /> Reintentar
           </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;