// src/components/RadarMap.tsx
import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Play, Pause, Loader2 } from 'lucide-react';
import L from 'leaflet';

// Importació d'imatges per fixar el bug d'icones de Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix icones
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Component auxiliar
function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

interface RadarFrame {
  time: number;
  path: string;
}

interface RadarMapProps {
  lat: number;
  lon: number;
}

export default function RadarMap({ lat, lon }: RadarMapProps) {
  const [timestamps, setTimestamps] = useState<RadarFrame[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const fetchRadarConfig = async () => {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        
        const allFrames: RadarFrame[] = [
           ...(data.radar?.past || []), 
           ...(data.radar?.nowcast || [])
        ].sort((a, b) => a.time - b.time);

        setTimestamps(allFrames);
        setCurrentIndex(allFrames.length - 6);
        setLoading(false);
        setIsPlaying(true); 
      } catch (e) {
        console.error("Error carregant radar:", e);
        setLoading(false);
      }
    };

    fetchRadarConfig();
  }, []);

  useEffect(() => {
    if (isPlaying && timestamps.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          return next >= timestamps.length ? 0 : next;
        });
      }, 500);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlaying, timestamps]);

  const currentFrame = timestamps[currentIndex];

  const formatTime = (ts?: number) => {
    if (!ts) return "--:--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
      <div className="h-full flex items-center justify-center text-slate-400 gap-2">
          <Loader2 className="animate-spin w-6 h-6" /> Carregant satèl·lit...
      </div>
  );

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
      
      <MapContainer 
        center={[lat, lon]} 
        zoom={8} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
      >
        <ChangeView center={[lat, lon]} />
        <ZoomControl position="topright" />

        <TileLayer
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {currentFrame && (
          <TileLayer
            key={currentFrame.time} 
            url={`https://tilecache.rainviewer.com/v2/radar/${currentFrame.time}/256/{z}/{x}/{y}/2/1_1.png`}
            opacity={0.8}
            zIndex={100}
          />
        )}
        
        <div className="leaflet-marker-pane">
            <div 
                style={{ 
                    position: 'absolute', 
                    left: '50%', top: '50%', 
                    width: '14px', height: '14px', 
                    background: '#3b82f6', 
                    borderRadius: '50%', 
                    border: '3px solid white', 
                    transform: 'translate(-50%, -50%)',
                    zIndex: 999,
                    boxShadow: '0 0 15px rgba(59, 130, 246, 0.6)'
                }} 
            />
        </div>
      </MapContainer>

      <div className="absolute bottom-6 left-6 right-6 z-[1000] bg-slate-900/90 backdrop-blur-md p-4 rounded-xl border border-white/10 flex items-center gap-4 shadow-xl">
        <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-12 h-12 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 rounded-full text-white transition-all shadow-lg shadow-indigo-500/20"
        >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
        </button>

        <div className="flex-1">
            <div className="flex justify-between text-xs text-slate-400 mb-2 font-medium uppercase tracking-wider">
                <span>Passat</span>
                <span className="text-white font-bold bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                    {formatTime(currentFrame?.time)}
                </span>
                <span>Previsió</span>
            </div>
            
            <input 
                type="range" 
                min="0" 
                max={timestamps.length - 1} 
                value={currentIndex} 
                onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentIndex(parseInt(e.target.value));
                }}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
            />
        </div>
      </div>

      <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 bg-red-500/90 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
        <span className="w-2 h-2 bg-white rounded-full"></span>
        EN DIRECTE
      </div>
    </div>
  );
}