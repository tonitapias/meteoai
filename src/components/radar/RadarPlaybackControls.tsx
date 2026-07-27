import { Play, Pause, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { RefObject } from 'react';

interface RadarPlaybackControlsProps {
  isPlaying: boolean;
  togglePlay: () => void;
  framesCount: number;
  currentFrameTimestamp: number | null;
  formatTime: (ts?: number | null) => string;
  loading: boolean;
  onRefresh: () => void;
  timeDisplayRef: RefObject<HTMLSpanElement | null>;
}

export function RadarPlaybackControls({ isPlaying, togglePlay, framesCount, currentFrameTimestamp, formatTime, loading, onRefresh, timeDisplayRef }: RadarPlaybackControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="absolute bottom-[max(env(safe-area-inset-bottom,24px),24px)] left-1/2 -translate-x-1/2 z-[1000] w-[94%] sm:w-[450px] flex items-center justify-between gap-3 pointer-events-none">
      <button 
        onClick={togglePlay} 
        disabled={framesCount === 0} 
        className={`pointer-events-auto flex items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300 shrink-0 active:scale-95 backdrop-blur-2xl border shadow-[0_8px_32px_rgba(0,0,0,0.6)] ${isPlaying ? 'bg-black/60 border-white/20 text-cyan-400 shadow-[inset_0_0_15px_rgba(6,182,212,0.15)]' : 'bg-cyan-500 border-cyan-400/50 text-black shadow-[0_0_20px_rgba(6,182,212,0.4)]'} disabled:opacity-30 disabled:cursor-not-allowed`} 
        aria-label={isPlaying ? t('btnPause') : t('btnPlay')}
      >
        {isPlaying ? <Pause className="w-7 h-7 fill-current drop-shadow-md" /> : <Play className="w-7 h-7 fill-current ml-1.5 drop-shadow-sm" />}
      </button>

      <div className="pointer-events-auto flex flex-col flex-1 items-center justify-center h-16 bg-black/50 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] px-5 ring-1 ring-white/5">
        <span className="text-[10px] text-cyan-300 font-mono font-black uppercase tracking-[0.25em] mb-0.5 drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
          {isPlaying ? t('animPlaying') : t('animCurrent')}
        </span>
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,1)] ${isPlaying ? 'bg-cyan-400 animate-ping shadow-[0_0_15px_rgba(6,182,212,0.8)]' : 'bg-cyan-500'}`}></span>
          <span ref={timeDisplayRef} className="text-white font-mono font-black text-2xl tracking-tighter tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,1)]">
            {currentFrameTimestamp ? formatTime(currentFrameTimestamp) : '--:--'}
          </span>
        </div>
      </div>

      <button 
        onClick={onRefresh} 
        disabled={loading} 
        className="pointer-events-auto flex items-center justify-center w-16 h-16 rounded-2xl bg-black/40 hover:bg-black/60 backdrop-blur-2xl border border-white/15 text-slate-200 hover:text-cyan-300 transition-all duration-300 active:scale-95 shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.6)]" 
        title={t('btnRefresh')}
        aria-label={t('btnRefresh')}
      >
        <RefreshCw className={`w-6 h-6 drop-shadow-lg ${loading ? 'animate-spin text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]' : ''}`} />
      </button>
    </div>
  );
}