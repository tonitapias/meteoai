// src/components/UpdatePrompt.tsx
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

// Avisa quan el Service Worker detecta una versió nova ja desplegada al host,
// en lloc de deixar la pestanya oberta executant JS obsolet fins que es
// penja en demanar un chunk que el nou desplegament ja no serveix.
interface UpdatePromptProps {
  /**
   * Hi ha la barra de pestanyes fixa a baix (interfície per pestanyes, fins a 1024 px): l'avís puja per sobre seu en
   * lloc de tapar-la. A partir de 1024 px la barra va a dalt i l'avís torna al seu lloc.
   */
  aboveTabBar?: boolean;
}

export default function UpdatePrompt({ aboveTabBar = false }: UpdatePromptProps) {
  const { t } = useTranslation();
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className={`fixed ${aboveTabBar ? 'bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-6' : 'bottom-6'} left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-5 fade-in duration-300`}>
      <div className="flex items-center gap-3 px-5 py-3 rounded-xl backdrop-blur-xl bg-black/60 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.25),inset_0_1px_1px_rgba(255,255,255,0.1)] text-cyan-50">
        <RefreshCw className="w-5 h-5 text-cyan-400 drop-shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
        <span className="text-sm font-semibold tracking-wider drop-shadow-md">
          {t('updateAvailable')}
        </span>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="ml-1 px-3 py-1 rounded-lg text-sm font-bold bg-cyan-500/20 border border-cyan-400/60 hover:bg-cyan-500/30 transition-colors"
        >
          {t('updateAction')}
        </button>
      </div>
    </div>
  );
}
