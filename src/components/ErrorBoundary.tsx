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
    // Actualitza l'estat perquè el següent render mostri la UI alternativa
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 1. Log a consola local (per desenvolupament)
    console.error("Error capturat al component:", error, errorInfo);
    
    // 2. Enviar informe automàtic a Sentry (amb tot l'historial de breadcrumbs que hem configurat abans)
    Sentry.captureException(error, { 
        contexts: { react: { componentStack: errorInfo.componentStack } } 
    });
  }

  handleRetry = () => {
      this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[200px] p-8 rounded-3xl bg-[#0B0C15]/80 border border-white/5 backdrop-blur-md flex flex-col items-center justify-center gap-5 text-center animate-in fade-in zoom-in-95 duration-500 shadow-2xl relative overflow-hidden">
           
           {/* Fons decoratiu subtil */}
           <div className="absolute top-0 right-0 w-[120px] h-[120px] bg-rose-500/10 rounded-full blur-[60px] -mr-8 -mt-8 pointer-events-none"></div>

           {/* Icona */}
           <div className="p-3 rounded-full bg-rose-500/10 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.2)] z-10">
              <AlertTriangle className="w-6 h-6" />
           </div>
           
           {/* Text */}
           <div className="flex flex-col gap-1.5 z-10">
              <h3 className="text-xs font-black text-rose-200 uppercase tracking-widest">Error del Sistema</h3>
              <p className="text-[10px] text-slate-400 font-mono max-w-[220px]">
                 No s&apos;ha pogut carregar aquest mòdul. S&apos;ha notificat el problema automàticament.
              </p>
           </div>

           {/* Botó d'Acció */}
           <button 
             onClick={this.handleRetry}
             className="flex items-center gap-2 px-6 py-2.5 mt-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white text-[10px] font-bold uppercase tracking-widest transition-all hover:scale-105 active:scale-95 cursor-pointer z-10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)]"
           >
             <RefreshCw className="w-3.5 h-3.5" /> Reintentar
           </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;