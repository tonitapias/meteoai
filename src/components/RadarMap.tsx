// RadarMap.tsx
import { useEffect, useState, useRef, useCallback, useMemo, Dispatch, SetStateAction } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useTranslation } from 'react-i18next';

// 1. DOMINI FÍSIC EXTRET
import {
  BaseLayerType,
  BaseLayerConfig,
  Overlays,
  getBlackMarbleUrl,
} from '../utils/radarPhysics';

// 2. DOMINI D'ESTAT EXTRET
import { useRadarData } from '../hooks/useRadarData';

// 3. COMPONENTS DE UI EXTRETS
import { RadarOverlays } from './radar/RadarOverlays';
import { RadarPlaybackControls } from './radar/RadarPlaybackControls';
import { RadarLayerMenu } from './radar/RadarLayerMenu';

// 4. ELS NOUS HOOKS (CLEAN ARCHITECTURE)
import { useAstroEngine } from '../hooks/radar/useAstroEngine';
import { useCameraFlight } from '../hooks/radar/useCameraFlight';
import { useRadarAnimation } from '../hooks/radar/useRadarAnimation';
import { useMapLifecycle } from '../hooks/radar/useMapLifecycle';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

if (MAPBOX_TOKEN) {
  mapboxgl.accessToken = MAPBOX_TOKEN;
} else {
  console.error("Alerta: No s'ha detectat VITE_MAPBOX_TOKEN al fitxer .env");
}

interface RadarMapProps {
  lat: number;
  lon: number;
  isActive: boolean;
  // Elevat a RadarModal.tsx: cal que el modal sàpiga si el menú està obert
  // per gestionar correctament Esc / botó enrere sense sortir del modal.
  // Tipat igual que el `useState` real de RadarModal (Dispatch<SetStateAction<boolean>>),
  // no una simple (show: boolean) => void, perquè useMapLifecycle ho exigeix.
  showLayerMenu: boolean;
  setShowLayerMenu: Dispatch<SetStateAction<boolean>>;
}

export default function RadarMap({ lat, lon, isActive, showLayerMenu, setShowLayerMenu }: RadarMapProps) {
  const { t } = useTranslation();

  const { loading, error, radarData, fetchRadarData } = useRadarData();

  const BASE_LAYERS: Record<BaseLayerType, BaseLayerConfig> = useMemo(() => ({
    dark: { name: t('baseDark', 'Fosc'), url: `https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`, attribution: '&copy; Mapbox' },
    light: { name: t('baseLight', 'Clar'), url: `https://api.mapbox.com/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${MAPBOX_TOKEN}`, attribution: '&copy; Mapbox' },
    relief: { name: t('baseRelief', 'Relleu'), url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
    sat_optic: { name: t('baseSat', 'Satèl·lit'), url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri' },
    black_marble: { name: t('baseNightMap', 'Terra de Nit (NASA)'), url: getBlackMarbleUrl(), attribution: '&copy; NASA GIBS' }
  }), [t]);

  // Estats UI Locals
  const [activeBaseLayer, setActiveBaseLayer] = useState<BaseLayerType>('sat_optic');
  // CORRECCIÓ (Fase 3): tipat explícitament amb la interfície Overlays
  // (font única de veritat a radarPhysics.ts) en lloc de deixar que
  // TypeScript l'infereixi de l'objecte literal.
  const [overlays, setOverlays] = useState<Overlays>({
    precip: true,
    satIR: true,
    hdGoes: false,
    hdMeteosat: false,
    hdHimawari: false,
    night: true,
    labels: false,
    nasaReal: false,
    nasaFires: false,
    terrain3D: false
  });

  // Referències essencials per als Hooks
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);
  const overlaysRef = useRef<Overlays>(overlays);
  const currentFrameTimestampRef = useRef<number | null>(null);

  const formatTime = useCallback((ts?: number | null) => {
    if (ts === null || ts === undefined || isNaN(ts)) return "--:--";
    return new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const toggleOverlay = useCallback((key: keyof Overlays) => {
    setOverlays(prev => {
      const next = { ...prev, [key]: !prev[key] };
      if (key === 'hdGoes' && next.hdGoes) {
        next.satIR = false; next.hdMeteosat = false; next.hdHimawari = false;
      } else if (key === 'hdMeteosat' && next.hdMeteosat) {
        next.satIR = false; next.hdGoes = false; next.hdHimawari = false;
      } else if (key === 'hdHimawari' && next.hdHimawari) {
        next.satIR = false; next.hdGoes = false; next.hdMeteosat = false;
      } else if (key === 'satIR' && next.satIR) {
        next.hdGoes = false; next.hdMeteosat = false; next.hdHimawari = false;
      }
      overlaysRef.current = next;
      return next;
    });
  }, []);

  // --- ARRANQUEN ELS NOUS HOOKS (CLEAN ARCHITECTURE) ---

  const { mapRef, webglKey, syncLayersState } = useMapLifecycle({
    mapContainerRef,
    lat,
    lon,
    activeBaseLayer,
    BASE_LAYERS,
    overlaysRef,
    setShowLayerMenu,
    syncAtmosphere: () => syncAtmosphere(),
    syncLighting: (ts: number | null) => syncLighting(ts),
    fetchRadarData
  });

  const { syncAtmosphere, syncLighting } = useAstroEngine({
    mapRef,
    lat,
    lon,
    activeBaseLayer,
    currentFrameTimestampRef
  });

  const {
    isPlaying, setIsPlaying, framesCount, currentFrameTimestamp,
    injectLayersIntoMap, togglePlay, setAnimationActive, applyFrameVisibility,
    radarFramesRef, currentFrameIndexRef
  } = useRadarAnimation({
    mapRef,
    overlaysRef,
    currentFrameTimestampRef,
    timeDisplayRef,
    formatTime,
    syncLighting,
    syncAtmosphere
  });

  useCameraFlight({
    mapRef,
    lat,
    lon,
    activeBaseLayer,
    overlays
  });

  // --- CONNECTORS FILLS (PONT ENTRE HOOKS) ---

  // 1. Dades Noves (Injecció)
  useEffect(() => {
    if (radarData && mapRef.current) {
      injectLayersIntoMap(radarData);
    }
  }, [radarData, injectLayersIntoMap, mapRef]);

  // 2. Sincronització global quan canvien els overlays o la baseLayer
  useEffect(() => {
    syncLayersState(
      overlays,
      activeBaseLayer,
      applyFrameVisibility,
      currentFrameIndexRef.current,
      radarFramesRef.current.length
    );
  }, [activeBaseLayer, overlays, syncLayersState, applyFrameVisibility, currentFrameIndexRef, radarFramesRef]);

  // 3. Gestió del Cicle de Vida Play/Pause vinculat a `isActive`
  useEffect(() => {
    if (!isActive) {
      const t = setTimeout(() => { setIsPlaying(false); }, 0);
      return () => clearTimeout(t);
    }
  }, [isActive, setIsPlaying]);

  useEffect(() => {
    setAnimationActive(isPlaying && isActive);
  }, [isPlaying, isActive, setAnimationActive]);


  return (
    <div className="relative w-full h-full min-h-0 overflow-hidden bg-[#020308] select-none [transform:translateZ(0)]">

      <RadarOverlays
        loading={loading}
        error={error}
        onForceSync={() => fetchRadarData(true)}
      />

      <div key={`mapbox-phoenix-${webglKey}`} ref={mapContainerRef} className="w-full h-full" />

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none z-10 flex items-center justify-center">
        <div className="absolute inset-0 bg-cyan-400/20 rounded-full animate-ping"></div>
        <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_12px_rgba(6,182,212,1)]"></div>
        <div className="absolute w-6 h-6 border border-cyan-500/30 rounded-full"></div>
      </div>

      <RadarLayerMenu
        showLayerMenu={showLayerMenu}
        setShowLayerMenu={setShowLayerMenu}
        activeBaseLayer={activeBaseLayer}
        setActiveBaseLayer={setActiveBaseLayer}
        overlays={overlays}
        toggleOverlay={toggleOverlay}
        baseLayers={BASE_LAYERS}
      />

      <RadarPlaybackControls
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        framesCount={framesCount}
        currentFrameTimestamp={currentFrameTimestamp}
        formatTime={formatTime}
        loading={loading}
        onRefresh={() => fetchRadarData(true)}
        timeDisplayRef={timeDisplayRef}
      />

    </div>
  );
}