// src/components/PullToRefresh.tsx
import React, { useRef } from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { RefreshCw, ArrowDown } from 'lucide-react';

interface Props {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isPulling, isRefreshing, pullDist } = usePullToRefresh(containerRef, { onRefresh });

  // Calculem l'opacitat i rotació basat en la distància
  const opacity = Math.min(pullDist / 100, 1);
  const rotation = Math.min(pullDist * 2, 180);

  return (
    <div 
      ref={containerRef} 
      className="relative min-h-screen w-full"
    >
      {/* INDICADOR DE CÀRREGA (ABSOLUT A DALT) */}
      <div 
        className="fixed top-0 left-0 w-full flex justify-center pointer-events-none z-50"
        style={{ 
          transform: `translateY(${Math.max(pullDist - 60, 0)}px)`, // Apareix des de dalt
          transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' 
        }}
      >
        <div className={`
          flex items-center gap-2 px-4 py-2 rounded-full 
          backdrop-blur-xl border border-white/10 shadow-2xl
          ${isRefreshing ? 'bg-indigo-500/80' : 'bg-slate-900/60'}
        `}>
          {isRefreshing ? (
            <>
              <RefreshCw className="w-5 h-5 text-white animate-spin" />
              <span className="text-xs font-bold text-white tracking-widest uppercase">Actualitzant...</span>
            </>
          ) : (
            <div 
              style={{ opacity }}
              className="flex items-center gap-2"
            >
              <ArrowDown 
                className="w-5 h-5 text-indigo-400" 
                style={{ transform: `rotate(${rotation}deg)` }} 
              />
              <span className="text-xs font-bold text-slate-300 tracking-widest uppercase">
                {pullDist > 100 ? 'Deixa anar' : 'Llisca avall'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CONTINGUT PRINCIPAL (ES MOU AVALL) */}
      <div 
        style={{ 
          transform: `translateY(${pullDist}px)`,
          transition: isPulling ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
          // Afegim una mica de resistència "rubber-band"
          filter: isPulling ? 'brightness(1.05)' : 'none'
        }}
      >
        {children}
      </div>
    </div>
  );
}