import { AlertTriangle, Radio } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.05] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:16px_16px]`;

interface RadarOverlaysProps {
  loading: boolean;
  error: boolean;
  onForceSync: () => void;
}

export function RadarOverlays({ loading, error, onForceSync }: RadarOverlaysProps) {
  const { t } = useTranslation();

  if (error) {
    return (
      <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-gradient-to-br from-[#0a0d16]/95 to-[#020308]/95 backdrop-blur-2xl p-6 text-center">
        <div className={MATRIX_BG}></div>
        <div className="w-20 h-20 rounded-2xl bg-rose-950/40 border border-rose-500/40 shadow-[inset_0_2px_15px_rgba(244,63,94,0.2),0_10px_30px_rgba(244,63,94,0.3)] flex items-center justify-center mb-6 relative z-10">
          <AlertTriangle className="w-10 h-10 text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]" />
        </div>
        <span className="text-white font-black tracking-[0.2em] uppercase mb-2 z-10 text-lg drop-shadow-md text-center px-4 max-w-[90vw] leading-tight">{t('errRadarDown')}</span>
        <span className="text-sm text-slate-400 font-mono mb-8 max-w-sm z-10 leading-relaxed text-center px-4">{t('errRadarDesc')}</span>
        <button onClick={onForceSync} className="px-8 py-4 bg-black/40 border border-white/20 hover:bg-white/10 hover:border-white/40 text-white rounded-xl text-sm font-black uppercase tracking-widest transition-all active:scale-95 z-10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {t('btnForceSync')}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-[#020308]/90 backdrop-blur-2xl transition-opacity duration-300">
        <div className={MATRIX_BG}></div>
        <div className="relative w-16 h-16 flex items-center justify-center mb-5 z-10">
          <div className="absolute inset-0 border-[4px] border-cyan-500/20 rounded-full shadow-[inset_0_0_20px_rgba(6,182,212,0.1)]"></div>
          <div className="absolute inset-0 border-[4px] border-cyan-400 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(6,182,212,0.5)]"></div>
          <Radio className="w-7 h-7 text-cyan-400 animate-pulse drop-shadow-[0_0_10px_rgba(6,182,212,1)]" />
        </div>
        <p className="text-cyan-300 text-sm font-mono font-bold tracking-[0.2em] uppercase z-10 drop-shadow-lg text-center px-4 max-w-[80vw] leading-relaxed">
          {t('syncingDoppler')}
        </p>
      </div>
    );
  }

  return null;
}