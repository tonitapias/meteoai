// src/components/Toast.tsx
import React, { useEffect } from 'react';
import { Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';

// Doctrina Risc Zero: Tipus exactes tancats. S'afegeix 'warning' per a alertes meteorològiques.
export type ToastType = 'info' | 'success' | 'warning' | 'error';

interface ToastProps {
  // Acceptem unknown per poder interceptar errors en temps d'execució sense trencar React
  message: unknown; 
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  // Doctrina Risc Zero: Sanitització extrema del missatge per evitar crasheos de renderitzat
  const safeMessage: string = 
    typeof message === 'string' ? message : 
    message instanceof Error ? message.message : 
    message ? String(message) : '';

  useEffect(() => {
    if (!safeMessage) return;
    
    const timer = setTimeout(() => {
        onClose();
    }, duration);
    
    return () => clearTimeout(timer);
  }, [safeMessage, duration, onClose]);

  // Si no hi ha missatge útil després de la sanitització, avortem el render de forma segura
  if (!safeMessage || safeMessage === 'undefined' || safeMessage === 'null') return null;

  // Spatial UI: Objecte de configuració amb glassmorphism i il·luminació tàctica per tipus
  const spatialConfig: Record<ToastType, { wrapper: string, icon: React.ReactNode }> = {
    info: {
      wrapper: "border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25),inset_0_1px_1px_rgba(255,255,255,0.1)] text-cyan-50",
      icon: <Info className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
    },
    success: {
      wrapper: "border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.25),inset_0_1px_1px_rgba(255,255,255,0.1)] text-emerald-50",
      icon: <CheckCircle className="w-5 h-5 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.8)]" />
    },
    warning: {
      wrapper: "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.25),inset_0_1px_1px_rgba(255,255,255,0.1)] text-amber-50",
      icon: <AlertCircle className="w-5 h-5 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]" />
    },
    error: {
      wrapper: "border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.25),inset_0_1px_1px_rgba(255,255,255,0.1)] text-rose-50",
      icon: <AlertTriangle className="w-5 h-5 text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.8)]" />
    }
  };

  const { wrapper, icon } = spatialConfig[type] || spatialConfig.info;

  return (
    // Z-index ultra elevat [9999] per garantir visibilitat sobre qualsevol component o mapa meteorològic
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-5 fade-in duration-300 pointer-events-none">
       
       {/* Base de comandament: bg-black/60 + backdrop-blur-xl */}
       <div className={`flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-xl bg-black/60 border pointer-events-auto transition-all ${wrapper}`}>
          {icon}
          {/* Lletra clara i amb tracking eixamplat per a millor llegibilitat ràpida */}
          <span className="text-sm font-semibold tracking-wider drop-shadow-md">
            {safeMessage}
          </span>
       </div>
       
    </div>
  );
}