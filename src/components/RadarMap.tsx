// src/components/RadarMap.tsx
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, AlertTriangle, RefreshCw, Play, Pause } from 'lucide-react';
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
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRadarData = async () => {
      setLoading(true);
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!response.ok) throw new Error('API Error');

        const rawData = await response.json();
        const parsed = RainViewerResponseSchema.safeParse(rawData);

        if (!parsed.success || !parsed.data.radar?.past?.length) {
            console.error("Error dades radar:", parsed.error);
            setError(true);
            return;
        }

        const data = parsed.data;
        setHost(data.host);
        setFrames(data.radar.past);
        
        // CANVI 1: Inicialitzem amb l'ÚLTIMA imatge disponible (la més recent)
        // Abans era -2, ara posem -1 per tenir l'última.
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
      // CANVI: En parar, tornem a l'última exacta
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
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
      
      {error && (
        <div className="absolute inset-0 z-[1001] flex flex-col items-center justify-center bg-slate-900/90 text-slate-400">
             <AlertTriangle className="w-8 h-8 text-amber-500 mb-2" />
             <span className="text-xs">Radar no disponible</span>
             <button onClick={fetchRadarData} className="text-indigo-400 underline text-xs mt-2">Reintentar</button>
        </div>
      )}

      {loading && !radarUrl && (
         <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-slate-900 text-indigo-500">
            <Loader2 className="animate-spin w-8 h-8" />
         </div>
      )}

      <MapContainer 
        center={[lat, lon]} 
        zoom={8} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
      >
        <ChangeView center={[lat, lon]} />
        <ZoomControl position="topleft" />

        <LayersControl position="topright">
            
            {/* CANVI 2: Treta la propietat 'checked' d'aquí */}
            <LayersControl.BaseLayer name="Fosc">
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

            {/* CANVI 2: Afegida la propietat 'checked' aquí (Per defecte) */}
            <LayersControl.BaseLayer checked name="Relleu">
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

        <div className="leaflet-marker-pane">
            <div style={{ position: 'absolute', left: '50%', top: '50%', width: '12px', height: '12px', background: '#3b82f6', borderRadius: '50%', border: '2px solid white', transform: 'translate(-50%, -50%)', zIndex: 999, boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)' }} />
        </div>
      </MapContainer>

      <div className="absolute bottom-4 right-4 z-[1000] bg-slate-900/90 backdrop-blur px-4 py-2 rounded-lg border border-white/10 flex items-center gap-4 shadow-lg">
        
        <button 
            onClick={togglePlay}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-lg shadow-indigo-500/30"
        >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
        </button>

        <div className="flex flex-col items-end border-l border-white/10 pl-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                {isPlaying ? 'Animació' : 'Temps Real'}
            </span>
            <span className="text-white font-mono text-sm font-bold">
                {currentFrame ? formatTime(currentFrame.time) : '--:--'}
            </span>
        </div>

        <button 
            onClick={fetchRadarData} 
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors ml-1"
            title="Actualitzar"
        >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

    </div>
  );
}