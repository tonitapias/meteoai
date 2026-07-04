// src/components/RadarMap.tsx
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, RefreshCw, Play, Pause, Radio } from 'lucide-react';
import L from 'leaflet';
import { z } from 'zod';

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

// --- SCHEMA (Host Dinàmic) ---
const RadarFrameSchema = z.object({
    time: z.number(),
    path: z.string(),
});

const RainViewerResponseSchema = z.object({
    host: z.string(),
    radar: z.object({
        past: z.array(RadarFrameSchema).default([]),
        nowcast: z.array(RadarFrameSchema).default([]),
    }).optional(),
});

type RadarFrame = z.infer<typeof RadarFrameSchema>;

// Component auxiliar per centrar el mapa
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

interface RadarMapProps {
  lat: number;
  lon: number;
}

export default function RadarMap({ lat, lon }: RadarMapProps) {
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [host, setHost] = useState<string>('');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [animationIndex, setAnimationIndex] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<boolean>(false);
  
  // SOLUCIÓ: Tipatge pur de TypeScript sense dependre de l'espai de noms de NodeJS
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRadarData = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!response.ok) throw new Error('API Error');

        const rawData = await response.json();
        const parsed = RainViewerResponseSchema.safeParse(rawData);

        // LÒGICA RISC ZERO: Flux de control estricte per Zod
        if (!parsed.success) {
            console.error("Error dades radar (Zod):", parsed.error);
            setError(true);
            return;
        }

        const data = parsed.data;
        
        // Ara sabem que parsed.success és true, validem les dades internes de forma segura
        if (!data.radar || !data.radar.past || data.radar.past.length === 0) {
            console.error("Error dades radar: absència de dades 'past' vàlides");
            setError(true);
            return;
        }

        setHost(data.host);
        setFrames(data.radar.past);
        
        const latestIndex = Math.max(0, data.radar.past.length - 2);
        setAnimationIndex(latestIndex);
        
        setError(false);
      } catch (e) {
        console.error(e);
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

  // --- LÒGICA D'ANIMACIÓ ---
  useEffect(() => {
    if (isPlaying && frames.length > 0) {
        timerRef.current = setInterval(() => {
            setAnimationIndex((prev) => (prev + 1) % frames.length);
        }, 500); 
    } else {
        if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, frames]);

  const togglePlay = () => {
      setIsPlaying(!isPlaying);
      if (!isPlaying) setAnimationIndex(0);
      else setAnimationIndex(Math.max(0, frames.length - 1));
  };

  const formatTime = (ts?: number) => {
    if (!ts) return "--:--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentFrame = frames[animationIndex];
  const radarUrl = currentFrame && host 
      ? `${host}${currentFrame.path}/256/{z}/{x}/{y}/6/1_1.png`
      : null;

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#020308]">
      
      {/* ESCUT D'ERROR */}
      {error && (
        <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-[#020308]/95 backdrop-blur-md">
             <div className="w-16 h-16 rounded-full bg-rose-950/30 border border-rose-900/50 flex items-center justify-center mb-4 relative">
                  <div className="absolute inset-0 rounded-full border border-rose-500/20 animate-ping"></div>
                  <AlertTriangle className="w-8 h-8 text-rose-500" />
             </div>
             <span className="text-white font-bold tracking-widest uppercase mb-1">Radar Doppler Caigut</span>
             <span className="text-xs text-slate-400 font-mono mb-4">No s&apos;han pogut rebre paquets de RainViewer</span>
             <button onClick={fetchRadarData} className="px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">Forçar Sincronització</button>
        </div>
      )}

      {/* PANTALLA DE CÀRREGA INICIAL */}
      {loading && !radarUrl && (
         <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-[#020308] backdrop-blur-md">
            <div className="relative w-16 h-16 flex items-center justify-center mb-4">
                 <div className="absolute inset-0 border-[3px] border-cyan-900/20 rounded-full"></div>
                 <div className="absolute inset-0 border-[3px] border-cyan-500 border-t-transparent border-l-transparent rounded-full animate-spin"></div>
                 <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
             </div>
             <p className="text-cyan-400/80 text-[10px] md:text-xs font-mono tracking-widest uppercase animate-pulse">
                Sincronitzant Doppler...
             </p>
         </div>
      )}

      {/* MAPA LEAFLET */}
      <MapContainer 
        center={[lat, lon]} 
        zoom={8} 
        style={{ height: '100%', width: '100%', background: '#020308' }}
        zoomControl={false}
      >
        <ChangeView center={[lat, lon]} />
        <ZoomControl position="topleft" />

        <LayersControl position="topright">
            <LayersControl.BaseLayer checked name="Fosc (Tàctic)">
                <TileLayer
                    attribution='&copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Clar (Blanc)">
                <TileLayer
                    attribution='&copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Relleu">
                <TileLayer
                    attribution='&copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}"
                />
            </LayersControl.BaseLayer>

            <LayersControl.BaseLayer name="Satèl·lit">
                <TileLayer
                    attribution='&copy; Esri'
                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                />
            </LayersControl.BaseLayer>

            <LayersControl.Overlay name="Etiquetes">
                 <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                    zIndex={200}
                />
            </LayersControl.Overlay>

            <LayersControl.Overlay checked name="Precipitació">
                {radarUrl && (
                  <TileLayer
                    key={radarUrl} 
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
        </LayersControl>

        {/* MARCADOR TÀCTIC SPATIAL UI (Posició de l'usuari/municipi) */}
        <div className="leaflet-marker-pane pointer-events-none">
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: '16px', height: '16px', transform: 'translate(-50%, -50%)', zIndex: 999 }}>
                <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
                <div className="absolute inset-1.5 bg-cyan-500 border border-white rounded-full shadow-[0_0_15px_rgba(6,182,212,0.8)]"></div>
            </div>
        </div>
      </MapContainer>

      {/* PANELL DE CONTROLS INFERIOR (HUD SPATIAL UI) */}
      <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 z-[1000] w-[90%] md:w-auto bg-[#050810]/80 backdrop-blur-xl px-4 py-3 rounded-2xl border border-white/10 flex items-center justify-between md:justify-start gap-4 sm:gap-6 shadow-[0_10px_40px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.05)]">
        
        <button 
            onClick={togglePlay}
            className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full transition-all duration-300 shadow-lg ${isPlaying ? 'bg-white/10 text-cyan-400 border border-cyan-500/30 hover:bg-white/20' : 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-cyan-500/30'}`}
        >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
        </button>

        <div className="flex flex-col flex-1 items-center md:items-end md:border-l md:border-white/10 md:pl-6 px-2">
            <span className="text-[9px] sm:text-[10px] text-cyan-500/80 font-black uppercase tracking-[0.2em] mb-0.5">
                {isPlaying ? 'Reproduint Matriu' : 'Captura Actual'}
            </span>
            <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                </span>
                <span className="text-white font-black text-lg sm:text-xl tracking-tighter drop-shadow-md">
                    {currentFrame ? formatTime(currentFrame.time) : '--:--'}
                </span>
            </div>
        </div>

        <button 
            onClick={fetchRadarData} 
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-400 border border-white/5 transition-all duration-200 active:scale-95"
            title="Sincronitzar Manualment"
        >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
        </button>
      </div>

    </div>
  );
}