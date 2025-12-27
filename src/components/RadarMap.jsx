import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, useMap, ZoomControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css'; // Estils del mapa
import { Play, Pause, Loader2 } from 'lucide-react';

// Component per centrar el mapa quan canvien les coordenades
function ChangeView({ center }) {
  const map = useMap();
  map.setView(center, map.getZoom());
  return null;
}

export default function RadarMap({ lat, lon }) {
  const [timestamps, setTimestamps] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  // 1. Descarregar configuració de RainViewer (timestamps disponibles)
  useEffect(() => {
    const fetchRadarConfig = async () => {
      try {
        const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        const data = await response.json();
        
        // Unim passat i predicció (nowcast)
        const allFrames = [
           ...(data.radar?.past || []), 
           ...(data.radar?.nowcast || [])
        ].sort((a, b) => a.time - b.time);

        setTimestamps(allFrames);
        setCurrentIndex(allFrames.length - 6); // Comencem una mica abans del final
        setLoading(false);
        setIsPlaying(true); // Auto-play al carregar
      } catch (e) {
        console.error("Error carregant radar:", e);
        setLoading(false);
      }
    };

    fetchRadarConfig();
  }, []);

  // 2. Gestió de l'animació
  useEffect(() => {
    if (isPlaying && timestamps.length > 0) {
      timerRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + 1;
          return next >= timestamps.length ? 0 : next; // Bucle infinit
        });
      }, 500); // Velocitat: 0.5s per frame
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isPlaying, timestamps]);

  const currentFrame = timestamps[currentIndex];

  // Format de l'hora per mostrar
  const formatTime = (ts) => {
    if (!ts) return "--:--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) return (
      <div className="h-full flex items-center justify-center text-slate-400 gap-2">
          <Loader2 className="animate-spin w-6 h-6" /> Carregant satèl·lit...
      </div>
  );

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
      
      {/* MAPA */}
      <MapContainer 
        center={[lat, lon]} 
        zoom={9} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
      >
        <ChangeView center={[lat, lon]} />
        <ZoomControl position="topright" />

        {/* Capa Base Fosca (CartoDB Dark Matter) - Ideal per disseny fosc */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {/* Capa Radar de RainViewer */}
        {currentFrame && (
          <TileLayer
            key={currentFrame.time} // Important per forçar el re-render quan canvia el frame
            url={`https://tilecache.rainviewer.com/v2/radar/${currentFrame.time}/256/{z}/{x}/{y}/2/1_1.png`}
            opacity={0.8}
            zIndex={100}
          />
        )}
        
        {/* Marcador de posició (Cercle senzill) */}
        <div className="leaflet-marker-pane">
            <div 
                style={{ 
                    position: 'absolute', 
                    left: '50%', top: '50%', 
                    width: '12px', height: '12px', 
                    background: '#3b82f6', 
                    borderRadius: '50%', 
                    border: '2px solid white', 
                    transform: 'translate(-50%, -50%)',
                    zIndex: 999,
                    boxShadow: '0 0 10px rgba(59, 130, 246, 0.5)'
                }} 
            />
        </div>
      </MapContainer>

      {/* CONTROLS (Overlay) */}
      <div className="absolute bottom-6 left-6 right-6 z-[1000] bg-slate-900/80 backdrop-blur-md p-4 rounded-xl border border-white/10 flex items-center gap-4 shadow-xl">
        
        <button 
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-10 h-10 flex items-center justify-center bg-indigo-500 hover:bg-indigo-600 rounded-full text-white transition-colors"
        >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        <div className="flex-1">
            <div className="flex justify-between text-xs text-slate-300 mb-1 font-medium">
                <span>{formatTime(timestamps[0]?.time)}</span>
                <span className="text-white font-bold text-sm bg-indigo-500/20 px-2 py-0.5 rounded">
                    {formatTime(currentFrame?.time)}
                </span>
                <span>{formatTime(timestamps[timestamps.length-1]?.time)}</span>
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
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>
      </div>

      {/* Llegenda senzilla */}
      <div className="absolute top-4 left-4 z-[1000] bg-slate-900/60 backdrop-blur text-white text-[10px] px-2 py-1 rounded border border-white/5">
        📡 Radar en temps real
      </div>
    </div>
  );
}