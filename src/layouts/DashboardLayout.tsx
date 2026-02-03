import React, { ReactNode } from 'react';
import { WeatherParticles } from '../components/WeatherIcons';

interface DashboardLayoutProps {
  /** Slot per a la capçalera (Header) */
  header: ReactNode;
  /** Slot per al contingut principal */
  children: ReactNode;
  /** Slot per al peu de pàgina (Footer) */
  footer: ReactNode;
  
  /** Elements flotants opcionals */
  modals?: ReactNode;
  toast?: ReactNode;
  debugPanel?: ReactNode;
  
  /** Codi del temps per a l'efecte de fons (partícules) */
  weatherCode?: number;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  header,
  children,
  footer,
  modals,
  toast,
  debugPanel,
  weatherCode = 0
}) => {
  return (
    <div className="min-h-screen bg-[#05060A] text-slate-50 font-sans transition-all duration-1000 overflow-x-hidden selection:bg-indigo-500/30 flex flex-col relative">
      
      {/* 1. Capa d'Efectes Globals */}
      <WeatherParticles code={weatherCode} />
      
      {/* 2. Capa de Debug (si n'hi ha) */}
      {debugPanel}

      {/* 3. Fons amb textura de soroll (Noise Filter) */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-0" 
        style={{backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`}}
      />

      {/* 4. Blobs de llum de fons */}
      <div className="fixed inset-0 pointer-events-none z-0">
          <div className="absolute top-[-10%] left-[50%] -translate-x-1/2 w-[1000px] h-[600px] bg-indigo-900/10 rounded-[100%] blur-[100px] opacity-60"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[800px] h-[600px] bg-blue-900/5 rounded-full blur-[120px] opacity-40"></div>
      </div>

      {/* 5. Notificacions */}
      {toast}

      {/* 6. Grid Principal (Contingut) */}
      <div className="w-full max-w-5xl mx-auto px-4 py-4 md:px-6 md:py-8 flex-1 flex flex-col relative z-10">
        
        {/* Slot: Capçalera */}
        {header}

        {/* Slot: Contingut Central */}
        <main className="mt-6 md:mt-10 flex-1">
            {children}
        </main>

        {/* Slot: Peu de pàgina */}
        <footer className="mt-auto">
             {footer}
        </footer>
      </div>

      {/* 7. Capa de Modals */}
      {modals}
    </div>
  );
};