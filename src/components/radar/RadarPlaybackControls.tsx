import { Play, Pause, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

interface RadarPlaybackControlsProps {
  isPlaying: boolean;
  togglePlay: () => void;
  framesCount: number;
  currentFrameTimestamp: number | null;
  formatTime: (ts?: number | null) => string;
  loading: boolean;
  onRefresh: () => void;
  timeDisplayRef: RefObject<HTMLSpanElement | null>;
  /** Barra de temps: el fotograma que es veu, les hores de tots (segons Unix, en ordre) i anar a un altre. */
  frameIndex?: number;
  frameTimes?: number[];
  onSeek?: (index: number) => void;
}

export function RadarPlaybackControls({ isPlaying, togglePlay, framesCount, currentFrameTimestamp, formatTime, loading, onRefresh, timeDisplayRef, frameIndex = 0, frameTimes = [], onSeek }: RadarPlaybackControlsProps) {
  const { t } = useTranslation();

  // Barra de temps (auditoria d'UX, segona volta, M6): abans només es podia reproduir l'animació sencera. A la v3.63.0
  // era una fila a part, a sobre dels botons; al mòbil ocupava massa. Ara és la mateixa targeta de l'hora: s'hi
  // arrossega el dit (o el ratolí) d'esquerra a dreta i una línia a la vora de baix diu on és el fotograma. Per al teclat
  // i el lector de pantalla hi ha un input range natiu, invisible però enfocable (fletxes, Inici i Fi). Moure-la atura
  // l'animació (vegeu seekFrame).
  const canSeek = !!onSeek && frameTimes.length > 1;
  const lastIndex = frameTimes.length - 1;
  const index = Math.max(0, Math.min(lastIndex, frameIndex));
  const frameTime = frameTimes[index];
  const progress = lastIndex > 0 ? (index / lastIndex) * 100 : 100;
  // Rellotge per dir quant fa de cada fotograma: s'actualitza en canviar de fotograma amb l'animació aturada i cada
  // minut (fora del render, com ageMin, i amb el mateix moment: la barra i l'etiqueta diuen els mateixos minuts).
  const [nowSec, setNowSec] = useState<number | null>(null);
  useEffect(() => {
    if (frameTimes.length < 2 || isPlaying) return;
    const update = () => setNowSec(Date.now() / 1000);
    const first = setTimeout(update, 0);
    const every = setInterval(update, 60_000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [frameTimes.length, index, isPlaying]);
  const frameValueText = frameTime === undefined ? undefined
    : index === lastIndex
      ? t('radarFrameNow', { time: formatTime(frameTime) })
      : nowSec === null
        ? formatTime(frameTime)
        : t('radarFrameValue', { time: formatTime(frameTime), n: Math.max(0, Math.round((nowSec - frameTime) / 60)) });

  // En pausa, quant fa de la imatge: abans posava "Captura actual 19:20" a les 20:23 (auditoria d'UX del 16/11/2026, M6).
  // Fins a 10 min es continua dient "captura actual" (el radar s'actualitza cada 5-10 min).
  const [ageMin, setAgeMin] = useState<number | null>(null);
  useEffect(() => {
    if (isPlaying || !currentFrameTimestamp) return;
    const update = () => setAgeMin(Math.round((Date.now() / 1000 - currentFrameTimestamp) / 60));
    const first = setTimeout(update, 0);
    const every = setInterval(update, 60_000);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [isPlaying, currentFrameTimestamp]);
  const pausedLabel = ageMin !== null && ageMin > 10 ? t('animFrameAge', { n: ageMin }) : t('animCurrent');

  // Arrossegar sobre la targeta. Amb els esdeveniments de punter i no amb l'input: a l'iPhone un input range només es
  // mou arrossegant-ne el polze, i invisible no se sabria on és. Només es demana un fotograma quan canvia.
  const dragging = useRef(false);
  const lastRequested = useRef<number | null>(null);
  const seekAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (!onSeek || box.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - box.left) / box.width));
    const target = Math.round(ratio * lastIndex);
    if (target === lastRequested.current) return;
    lastRequested.current = target;
    onSeek(target);
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!canSeek || (e.pointerType === 'mouse' && e.button !== 0)) return;
    dragging.current = true;
    lastRequested.current = null;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    seekAt(e);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => { if (dragging.current) seekAt(e); };
  const endDrag = () => { dragging.current = false; };

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

      <div
        data-testid="radar-scrubber"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`pointer-events-auto relative flex flex-col flex-1 min-w-0 items-center justify-center h-16 bg-black/50 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] px-4 ring-1 ring-white/5 select-none overflow-hidden ${canSeek ? 'cursor-ew-resize touch-none pb-3' : ''}`}
      >
        {canSeek && (
          <>
            <input
              type="range"
              min={0}
              max={lastIndex}
              step={1}
              value={index}
              onChange={(e) => onSeek?.(Number(e.target.value))}
              aria-label={t('radarTimeline')}
              aria-valuetext={frameValueText}
              data-testid="radar-timeline"
              className="peer sr-only"
            />
            {/* El focus del teclat, a tota la targeta (l'input és invisible). */}
            <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-2xl peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-cyan-400/80" />
          </>
        )}
        {/* Una sola línia, sempre: arrossegant enrere, «IMATGE DE FA 42 MIN» saltava a dues línies (amb la lletra del
            mòbil una mica gran) i empenyia l'hora fins a sobre de la línia de progrés. Ara l'etiqueta és curta («FA 42
            MIN») i, si un dia no hi cabés, es retalla dins la targeta. pb-3 reserva la franja de la línia de progrés. */}
        <span className="block max-w-full truncate whitespace-nowrap leading-none text-[10px] text-cyan-300 font-mono font-black uppercase tracking-[0.12em] mb-1 drop-shadow-[0_1px_4px_rgba(0,0,0,1)]">
          {isPlaying ? t('animPlaying') : pausedLabel}
        </span>
        <div className="flex items-center gap-3 max-w-full leading-none">
          <span className={`shrink-0 h-2.5 w-2.5 rounded-full shadow-[0_0_10px_rgba(0,0,0,1)] ${isPlaying ? 'bg-cyan-400 animate-ping shadow-[0_0_15px_rgba(6,182,212,0.8)]' : 'bg-cyan-500'}`}></span>
          <span ref={timeDisplayRef} className="whitespace-nowrap leading-none text-white font-mono font-black text-2xl tracking-tighter tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,1)]">
            {currentFrameTimestamp ? formatTime(currentFrameTimestamp) : '--:--'}
          </span>
        </div>
        {canSeek && (
          // On és el fotograma que es veu, de la imatge més antiga (esquerra) a la més recent (dreta).
          <span aria-hidden="true" data-testid="radar-progress" className="pointer-events-none absolute left-4 right-4 bottom-1.5 h-1 rounded-full bg-white/15">
            <span className="absolute inset-y-0 left-0 rounded-full bg-cyan-400/80" style={{ width: `${progress}%` }} />
            <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_6px_rgba(34,211,238,0.8)]" style={{ left: `${progress}%` }} />
          </span>
        )}
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
