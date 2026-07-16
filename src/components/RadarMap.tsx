// src/components/RadarMap.tsx
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, RefreshCw, Play, Pause, Radio } from 'lucide-react';
import L from 'leaflet';
import { z } from 'zod';
import { TRANSLATIONS, Language } from '../translations';

// --- CONFIGURACIÓ D'ICONES LEAFLET ---
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: () => string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// --- SCHEMA (Cervell de Dades Tàctiques Ampliat) ---
const RadarFrameSchema = z.object({
    time: z.number(),
    path: z.string(),
});

// DOCTRINA RISC ZERO: Interceptem la capa "satellite.infrared" sense fer cap crida de xarxa extra.
const RainViewerResponseSchema = z.object({
    host: z.string(),
    radar: z.object({
        past: z.array(RadarFrameSchema).default([]),
        nowcast: z.array(RadarFrameSchema).default([]),
    }).optional(),
    satellite: z.object({
        infrared: z.array(RadarFrameSchema).default([]),
    }).optional(),
});

type RadarFrame = z.infer<typeof RadarFrameSchema>;

// DOCTRINA RISC ZERO: Component auxiliar blindat
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface RadarMapProps {
  lat: number;
  lon: number;
  lang: Language;
}

export default function RadarMap({ lat, lon, lang }: RadarMapProps) {
  // Motor de traducció segur
  const tRecord = (TRANSLATIONS[lang] || TRANSLATIONS['ca']) as Record<string, unknown>;
  const t = (key: string, fallback: string): string => {
      return typeof tRecord[key] === 'string' ? (tRecord[key] as string) : fallback;
  };

  const [radarFrames, setRadarFrames] = useState<RadarFrame[]>([]);
  const [satelliteFrames, setSatelliteFrames] = useState<RadarFrame[]>([]);
  const [host, setHost] = useState<string>('');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationIndex, setAnimationIndex] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRadarData = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!response.ok) throw new Error('API Error');

        const rawData = await response.json();
        const parsed = RainViewerResponseSchema.safeParse(rawData);

        if (!parsed.success) {
            console.error("Error dades radar (Zod):", parsed.error);
            setError(true);
            return;
        }

        const data = parsed.data;
        const rFrames = data.radar?.past || [];
        const sFrames = data.satellite?.infrared || [];
        
        if (rFrames.length === 0) {
            console.error("Error dades radar: absència de dades 'past' vàlides");
            setError(true);
            return;
        }

        setHost(data.host);
        setRadarFrames(rFrames);
        setSatelliteFrames(sFrames);
        
        const latestIndex = Math.max(0, rFrames.length - 2);
        setAnimationIndex(latestIndex);
        
        setError(false);
      } catch (e) {
        console.error("Error d'obtenció de matriu:", e);
        setError(true);
      } finally {
        setLoading(false);
      }
  };

  useEffect(() => {
    fetchRadarData();
    const interval = setInterval(fetchRadarData, 600000); 
    return () => clearInterval(interval);
  }, []);

  // --- LÒGICA D'ANIMACIÓ (Motor Unificat) ---
  useEffect(() => {
    if (isPlaying && radarFrames.length > 0) {
        timerRef.current = setInterval(() => {
            setAnimationIndex((prev) => (prev + 1) % radarFrames.length);
        }, 500); 
    } else {
        if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, radarFrames]);

  const togglePlay = () => {
      if (radarFrames.length === 0) return;
      setIsPlaying(!isPlaying);
      if (!isPlaying) setAnimationIndex(0);
      else setAnimationIndex(Math.max(0, radarFrames.length - 1));
  };

  const formatTime = (ts?: number) => {
    if (!ts || isNaN(ts)) return "--:--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // --- MATEMÀTICA SEGURA: Sincronització Temporal ---
  const currentRadarFrame = radarFrames[animationIndex] || null;
  let currentSatFrame: RadarFrame | null = null;
  
  if (satelliteFrames.length > 0 && currentRadarFrame) {
      currentSatFrame = satelliteFrames.reduce((prev, curr) => {
          return Math.abs(curr.time - currentRadarFrame.time) < Math.abs(prev.time - currentRadarFrame.time) ? curr : prev;
      });
  }

  const radarUrl = currentRadarFrame && host 
      ? `${host}${currentRadarFrame.path}/256/{z}/{x}/{y}/6/1_1.png`
      : null;

  const satUrl = currentSatFrame && host
      ? `${host}${currentSatFrame.path}/256/{z}/{x}/{y}/0/1_1.png`
      : null;

  // SPATIAL UI BASE
  const MATRIX_BG = `absolute inset-0 z-0 opacity-[0.03] pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:12px_12px]`;

  if (error) {
     return (
        <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-gradient-to-br from-[#0f111a]/95 to-black/90 backdrop-blur-md">
            <div className={MATRIX_BG}></div>
            <div className="w-16 h-16 rounded-full bg-rose-950/40 border border-rose-500/30 shadow-[inset_0_1px_8px_rgba(244,63,94,0.3)] flex items-center justify-center mb-4 relative backdrop-blur-sm z-10">
                 <div className="absolute inset-0 rounded-full border border-rose-500/30 animate-ping opacity-50"></div>
                 <AlertTriangle className="w-8 h-8 text-rose-500 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]" />
            </div>
            <span className="text-white font-black tracking-widest uppercase mb-1 drop-shadow-md z-10">{t('errRadarDown', 'Radar Doppler Caigut')}</span>
            <span className="text-xs text-slate-400 font-mono font-bold mb-6 z-10">{t('errRadarDesc', "No s'han pogut rebre paquets de RainViewer")}</span>
            <button onClick={fetchRadarData} className="px-6 py-2.5 bg-[#0a0b10]/80 border border-white/10 hover:bg-white/10 text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-[inset_0_1px_4px_rgba(255,255,255,0.05)] z-10">{t('btnForceSync', 'Forçar Sincronització')}</button>
        </div>
     );
  }

  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-[#020308]">
      
      {loading && !radarUrl && (
         <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-gradient-to-br from-[#0f111a]/95 to-black/90 backdrop-blur-md">
            <div className={MATRIX_BG}></div>
            <div className="relative w-16 h-16 flex items-center justify-center mb-4 z-10">
                 <div className="absolute inset-0 border-[3px] border-cyan-900/20 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.1)]"></div>
                 <div className="absolute inset-0 border-[3px] border-cyan-400 border-t-transparent border-l-transparent rounded-full animate-spin"></div>
                 <Radio className="w-6 h-6 text-cyan-400 animate-pulse drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
             </div>
             <p className="text-cyan-400/80 text-[10px] md:text-xs font-mono font-bold tracking-widest uppercase animate-pulse z-10">
                {t('syncingDoppler', 'Sincronitzant Doppler & IR...')}
             </p>
         </div>
      )}

      <MapContainer 
        center={[lat, lon]} 
        zoom={8} 
        style={{ height: '100%', width: '100%', background: '#020308' }}
        zoomControl={false}
      >
        <ChangeView center={[lat, lon]} />
        <ZoomControl position="topleft" />

        <LayersControl position="topright">
            <LayersControl.BaseLayer checked name={t('layerDark', 'Fosc (Tàctic)')}>
                <TileLayer
                    attribution='&copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name={t('layerLight', 'Clar (Blanc)')}>
                <TileLayer
                    attribution='&copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name={t('layerRelief', 'Relleu')}>
                <TileLayer
                    attribution='&copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name={t('layerSatOptic', 'Satèl·lit (Òptic)')}>
                <TileLayer
                    attribution='&copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
            </LayersControl.BaseLayer>

            <LayersControl.Overlay name={t('layerSatIR', 'Núvols (Satèl·lit IR)')}>
                {satUrl && (
                  <TileLayer
                    key={`sat-${satUrl}`} 
                    url={satUrl}
                    opacity={0.65}
                    zIndex={90}
                    tileSize={256}
                    minZoom={0}
                    maxNativeZoom={6}
                    maxZoom={22}
                  />
                )}
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name={t('layerPrecip', 'Precipitació (Radar)')}>
                {radarUrl && (
                  <TileLayer
                    key={`rad-${radarUrl}`} 
                    url={radarUrl}
                    opacity={0.8}
                    zIndex={100}
                    tileSize={256}
                    minZoom={0}
                    maxNativeZoom={6} 
                    maxZoom={22}
                  />
                )}
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name={t('layerLabels', 'Etiquetes')}>
                 <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                    zIndex={200}
                />
            </LayersControl.Overlay>
        </LayersControl>

        <div className="leaflet-marker-pane pointer-events-none">
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: '16px', height: '16px', transform: 'translate(-50%, -50%)', zIndex: 999 }}>
                <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
                <div className="absolute inset-1.5 bg-cyan-500 border border-white rounded-full shadow-[0_0_15px_rgba(6,182,212,0.8)]"></div>
            </div>
        </div>
      </MapContainer>

      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-[1000] w-[90%] md:w-auto bg-[#050810]/80 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/10 flex items-center justify-between md:justify-start gap-4 sm:gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)] transition-colors duration-500 hover:border-cyan-500/20">
        
        <button 
            type="button"
            onClick={togglePlay}
            disabled={radarFrames.length === 0}
            className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all duration-300 shadow-[inset_0_1px_4px_rgba(255,255,255,0.2)] active:scale-95 ${isPlaying ? 'bg-white/10 text-cyan-400 border border-cyan-500/30 hover:bg-white/20' : 'bg-cyan-500 hover:bg-cyan-400 text-white drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]'} disabled:opacity-50 disabled:cursor-not-allowed`}
            aria-label={isPlaying ? t('ariaPause', 'Pausar Animació') : t('ariaPlay', 'Iniciar Animació')}
        >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
        </button>

        <div className="flex flex-col flex-1 items-center md:items-end md:border-l md:border-white/10 md:pl-6 px-2">
            <span className="text-[9px] sm:text-[10px] text-cyan-500/80 font-black uppercase tracking-[0.2em] mb-0.5">
                {isPlaying ? t('playMatrix', 'Reproduint Matriu') : t('currentCapture', 'Captura Actual')}
            </span>
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    {isPlaying && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>}
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500 shadow-[0_0_5px_currentColor]"></span>
                </span>
                <span className="text-white font-mono font-black text-lg sm:text-xl tracking-tighter drop-shadow-md tabular-nums">
                    {currentRadarFrame ? formatTime(currentRadarFrame.time) : '--:--'}
                </span>
            </div>
        </div>

        <button 
            type="button"
            onClick={fetchRadarData} 
            className="p-2.5 rounded-full bg-black/40 hover:bg-white/10 text-slate-400 hover:text-cyan-400 border border-white/5 transition-all duration-200 active:scale-95 shadow-inner"
            title={t('btnForceSync', 'Forçar Sincronització')}
            aria-label={t('btnForceSync', 'Forçar Sincronització')}
        >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>
    </div>
  );
}