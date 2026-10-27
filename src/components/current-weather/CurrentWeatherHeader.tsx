import { Navigation, Zap, ShieldCheck, Mountain, MapPinOff, MapPinned, Route, Share2 } from 'lucide-react';

/** Una posició rebuda amb un enllaç `origen=gps` (vegeu utils/placeLink.ts), amb els textos ja traduïts. */
export interface SharedPositionInfo {
  label: string;
  /** "41.98315, 2.82493" */
  coords: string;
  mapsUrl: string;
  directionsUrl: string;
  openLabel: string;
  directionsLabel: string;
}

interface CurrentWeatherHeaderProps {
  locationName?: string;
  country?: string;
  time?: string;
  date?: string;
  modelLabel: string | null;
  elevation?: number | null;
  /** Amb una posició rebuda, la insígnia del país diu "Posició compartida" i hi ha els botons de Google Maps. */
  sharedPosition?: SharedPositionInfo | null;
  /** Compartir el lloc (vegeu useAppActions.handleSharePlace): botó a dalt a la dreta. Sense, no hi és. */
  onShare?: () => void;
  shareLabel?: string;
}

// Botons de Google Maps: enllaços a una pestanya nova; 44 px d'alt (mida tàctil). Un al costat de l'altre si cada un té
// 8,5 rem; si no (320 px), un sota l'altre a tota l'amplada: abans hi quedaven "Obre a / Google / Maps" i "arribar- / hi".
const MAPS_LINK = "flex-1 basis-[8.5rem] min-w-0 flex items-center justify-center gap-2 min-h-[44px] px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-100 text-xs font-bold leading-tight text-center transition-colors active:scale-95";

export const CurrentWeatherHeader = ({
  locationName,
  country,
  time,
  date,
  modelLabel,
  elevation,
  sharedPosition = null,
  onShare,
  shareLabel = 'Compartir aquest lloc',
}: CurrentWeatherHeaderProps) => {
  
  // DOCTRINA RISC ZERO: Validació estricta i fallbacks absoluts
  const isValidElevation = typeof elevation === 'number' && !isNaN(elevation);
  const safeElevation = isValidElevation ? Math.round(elevation) : '--';
  const safeLocation = locationName && locationName.trim() !== '' ? locationName : 'UBICACIÓ DESCONEGUDA';
  const safeCountry = country && country.trim() !== '' ? country : '--';
  const safeTime = time || '--:--';
  const safeDate = date || '--/--/----';

  return (
    <div className="flex justify-between items-start w-full relative z-10">
      <div className="flex flex-col gap-1 w-full">
        
        {/* Badges Superiors (Spatial UI) i, a la dreta, Compartir. Les insígnies poden passar a dues línies ("Posició
            compartida" amb un model de nom llarg a 320 px) sense desplaçar el botó; -my-1.5: el botó fa 44 px tàctils
            però la fila només creix fins a 32 px (no toca el nom de sota). */}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 flex-1 min-w-0">
          {sharedPosition ? (
            // No és un lloc qualsevol: és on era qui ha enviat l'enllaç.
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-cyan-500/10 border-cyan-500/40 shadow-[inset_0_1px_4px_rgba(34,211,238,0.15)]">
              <MapPinned className="w-3 h-3 text-cyan-300" aria-hidden="true" />
              <span className="text-[9px] font-mono font-black tracking-widest uppercase text-cyan-100">
                {sharedPosition.label}
              </span>
            </div>
          ) : (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border shadow-[inset_0_1px_4px_rgba(255,255,255,0.1)] transition-colors duration-500 ${safeCountry !== '--' ? 'bg-[#0f111a]/80 border-white/10' : 'bg-slate-900/50 border-slate-700/50'}`}>
            {safeCountry !== '--' ? (
                <Navigation className="w-3 h-3 text-indigo-400 drop-shadow-[0_0_5px_rgba(129,140,248,0.5)]" />
            ) : (
                <MapPinOff className="w-3 h-3 text-slate-500" />
            )}
            <span className={`text-[9px] font-mono font-black tracking-widest uppercase transition-colors duration-500 ${safeCountry !== '--' ? 'text-indigo-200' : 'text-slate-500'}`}>
              {safeCountry}
            </span>
          </div>
          )}
          
          {modelLabel ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 shadow-[inset_0_1px_4px_rgba(16,185,129,0.2)] text-[9px] font-mono font-black text-emerald-400 tracking-widest uppercase transition-all duration-300">
              <Zap className="w-3 h-3 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" /> {modelLabel}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 shadow-[inset_0_1px_4px_rgba(99,102,241,0.2)] text-[9px] font-mono font-black text-indigo-400 tracking-widest uppercase transition-all duration-300">
              <ShieldCheck className="w-3 h-3 drop-shadow-[0_0_8px_rgba(129,140,248,0.8)]" /> MODEL GLOBAL
            </span>
          )}
          </div>

          {onShare && (
            <button
              type="button"
              onClick={onShare}
              aria-label={shareLabel}
              title={shareLabel}
              className="-my-1.5 -mr-1 w-11 h-11 shrink-0 flex items-center justify-center rounded-xl bg-[#0a0b10]/80 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-cyan-300 transition-colors active:scale-95"
            >
              <Share2 className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Títol / Nom de la ubicació */}
        <h2 className={`text-4xl md:text-6xl font-black uppercase tracking-tighter leading-[0.9] drop-shadow-xl break-words mt-1 transition-colors duration-700 ${safeLocation !== 'UBICACIÓ DESCONEGUDA' ? 'text-white' : 'text-slate-500'}`}>
          {safeLocation}
        </h2>

        {/* Dades Temporals i Telemetria */}
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 mt-3">
          <span className={`text-2xl font-mono font-medium tracking-tight transition-colors duration-500 ${safeTime !== '--:--' ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
            {safeTime}
          </span>
          
          <div className={`h-4 w-px transition-colors duration-500 ${safeTime !== '--:--' || safeDate !== '--/--/----' ? 'bg-white/10' : 'bg-slate-800'}`}></div>
          
          <span className={`text-sm font-bold uppercase tracking-wider transition-colors duration-500 ${safeDate !== '--/--/----' ? 'text-slate-400' : 'text-slate-600'}`}>
            {safeDate}
          </span>
          
          <div className={`h-4 w-px transition-colors duration-500 ${safeDate !== '--/--/----' || isValidElevation ? 'bg-white/10' : 'bg-slate-800'}`}></div>
          
          <div className={`flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider transition-colors duration-500 ${isValidElevation ? 'text-slate-400' : 'text-slate-600'}`} title="Altitud">
            <Mountain className={`w-4 h-4 transition-colors duration-500 ${isValidElevation ? 'text-slate-500' : 'text-slate-700'}`} />
            <span className="tabular-nums">{safeElevation}{isValidElevation ? 'm' : ''}</span>
          </div>
        </div>

        {/* Posició rebuda: les coordenades (es poden copiar o dictar) i com anar-hi. data-sentry-block: els enllaços porten
            la posició exacta i Sentry Replay no els grava (vegeu utils/telemetryPrivacy.ts). */}
        {sharedPosition && (
          <div className="flex flex-col gap-2 mt-4" data-sentry-block>
            <span className="text-sm font-mono font-bold tabular-nums text-cyan-100 select-all">{sharedPosition.coords}</span>
            <div className="flex flex-wrap gap-2">
              <a href={sharedPosition.mapsUrl} target="_blank" rel="noopener noreferrer" className={MAPS_LINK}>
                <MapPinned className="w-4 h-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <span>{sharedPosition.openLabel}</span>
              </a>
              <a href={sharedPosition.directionsUrl} target="_blank" rel="noopener noreferrer" className={MAPS_LINK}>
                <Route className="w-4 h-4 shrink-0 text-cyan-300" aria-hidden="true" />
                <span>{sharedPosition.directionsLabel}</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};