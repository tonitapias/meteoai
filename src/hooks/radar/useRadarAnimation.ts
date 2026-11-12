import { useState, useRef, useCallback, useEffect, RefObject, MutableRefObject } from 'react';
import type { Map, RasterPaint } from 'mapbox-gl';
import { z } from 'zod';
import {
  RainViewerResponseSchema,
  RadarFrame,
  Overlays,
  getRadOpacityExp,
  getSatOpacityExp,
  Z_LAYERS,
  HD_BOUNDS,
  HD_VARIANTS,
  SAT_PROXY_HOST,
  LIGHTNING_BOUNDS,
  LIGHTNING_ROUTE,
  AMERICAS_LIGHTNING_BOUNDS,
  AMERICAS_LIGHTNING_ROUTE,
  computeMeteosatSlot,
  computeGibsSlot,
  computeLightningSlots,
  computeAmericasLightningSlots,
  getHdColourOpacityExp,
  hdRoute,
  type GibsAgency,
  type HdAgency,
  type HdVariant
} from '../../utils/radarPhysics';
import type { GibsTimelineState, HdTimelineState, LightningTimelineState } from './useHdTimeline';
import { RADAR_TILE_OPTIONS, sampleZoomForHost } from '../../utils/radarSampling';

interface UseRadarAnimationProps {
  mapRef: MutableRefObject<Map | null>;
  overlaysRef: MutableRefObject<Overlays>;
  currentFrameTimestampRef: MutableRefObject<number | null>;
  timeDisplayRef: RefObject<HTMLSpanElement | null>;
  formatTime: (ts?: number | null) => string;
  syncLighting: (timestampMs: number | null) => void;
  syncAtmosphere: () => void;
  styleReadyRef: MutableRefObject<boolean>;
  hdTimelineRef: MutableRefObject<HdTimelineState>;
  gibsTimelineRefs: Record<GibsAgency, MutableRefObject<GibsTimelineState>>;
  lightningTimelineRef: MutableRefObject<LightningTimelineState>;
  americasLightningTimelineRef: MutableRefObject<LightningTimelineState>;
}

const HD_AGENCIES: HdAgency[] = ['goes', 'meteosat', 'himawari'];

const isHdEnabled = (o: Overlays, agency: HdAgency): boolean =>
  agency === 'goes' ? o.hdGoes : agency === 'meteosat' ? o.hdMeteosat : o.hdHimawari;

// Capa HD d'un fotograma: la clau porta la variant perquè una franja MSG de
// :00/:30 no xoqui amb la mateixa hora de MTG (ni l'IR amb el color).
interface HdTarget { key: string; variant: HdVariant; slot: number }
const hdLayerId = (agency: HdAgency, key: string) => `hd-${agency}-layer-${key}`;
const hdSourceId = (agency: HdAgency, key: string) => `hd-${agency}-src-${key}`;
const hdVariantOfKey = (key: string) => key.split('-')[0] as HdVariant;
// GeoColour és una fotografia opaca: opacitat pròpia (vegeu radarPhysics).
const hdOpacityExp = (key: string, baseOp: number) =>
  HD_VARIANTS[hdVariantOfKey(key)].colour ? getHdColourOpacityExp(baseOp) : getSatOpacityExp(baseOp);

// Llamps: una capa per franja. MTG (clau = la franja de 5 min; cada
// fotograma en mostra dues) i Amèrica (clau `am-` + la finestra de 15 min;
// una per fotograma).
const AMERICAS_KEY_PREFIX = 'am-';
const lightningLayerId = (key: string) => `ltg-layer-${key}`;
const lightningSourceId = (key: string) => `ltg-src-${key}`;
const LIGHTNING_OPACITY = 0.95;
// La paleta d'EUMETSAT és opaca: en una tempesta gran l'àrea de llamps (cada
// llamp pinta tota la superfície que il·lumina) tapava el radar de sota a
// zoom 7. Es recolora per lluminositat: on hi ha pocs llamps (groc pàl·lid,
// lluminós) queda translúcid i deixa veure el radar, i els nuclis intensos
// (granat, fosc) continuen opacs. Els píxels sense llamps (0,0,0,0) donen 0
// i queden transparents; 'nearest' evita que la interpolació amb aquests
// píxels a les vores doni valors foscos (granat) que no hi són.
const LIGHTNING_PAINT: RasterPaint = {
  'raster-resampling': 'nearest',
  'raster-color-mix': [0.2126, 0.7152, 0.0722, 0],
  'raster-color-range': [0, 1],
  'raster-color': [
    'interpolate', ['linear'], ['raster-value'],
    0, 'rgba(0,0,0,0)',
    0.06, 'rgba(0,0,0,0)',
    0.1, 'rgba(140,0,38,1)',
    0.6, 'rgba(253,120,40,0.95)',
    0.86, 'rgba(255,200,60,0.7)',
    1, 'rgba(255,235,90,0.45)'
  ]
};
// nowCOAST pinta la densitat de llamps (llamps/km²/min × 10³, en 15 min i
// 8 km: ~llamps per píxel) amb 17 classes de colors d'arc de Sant Martí
// (groc → vermell → magenta → blau → verd), que cap combinació lineal de
// R, G i B no ordena. Aquests pesos en canvi en separen cada color dels de les
// altres classes (com a mínim ~10 de les 256 entrades de la rampa) i el
// `step` dona a cada classe un color de la rampa de MTG (LIGHTNING_PAINT).
// Valors (amb el desplaçament de 1,5): ffffcc 0,008 · ffec78 0,142 ·
// ff00ff 0,230 · ffff00 0,280 · ffd600 0,327 · ffa400 0,384 · ff7800 0,434 ·
// ff4500 0,492 · ff0000 0,570 · cc0066 0,620 · bc0025 0,765 · 800080 0,863 i
// els blaus i verds (≥ 100) fins a 1,21. Els píxels sense llamps són
// transparents (alfa 0) i continuen transparents.
// Quin color de la rampa: per quantils, perquè les dues fonts es vegin igual
// a la frontera. 2026-11-09, 6 finestres de 15 min sobre el Brasil (70°–35° O,
// 25° S–15° N), on totes dues tenen dades: 114 000 píxels de nowCOAST contra
// 179 000 de MTG (les seves 3 franges de 5 min, la més intensa). MTG hi és
// sobretot groc pàl·lid (mediana 0,94 de la rampa): el 55 % de nowCOAST que
// fa menys d'1 hi correspon a ~0,96, 1–2,5 a 0,94, 2,5–5 a 0,92, 5–10 a 0,89,
// 10–15 a 0,80, 15–25 a 0,72, 25–50 a 0,46 i 50 o més (el 4 %) a 0,16.
const AMERICAS_LIGHTNING_PAINT: RasterPaint = {
  'raster-resampling': 'nearest',
  'raster-color-mix': [-0.93, -0.29, -0.34, 1.5],
  'raster-color-range': [0, 1.25],
  'raster-color': [
    'step', ['raster-value'],
    'rgba(255,225,81,0.52)', // 0,1–0,5
    0.186, 'rgba(154,15,38,0.99)', // 50–75 (magenta)
    0.255, 'rgba(255,225,81,0.52)', // 0,5–1
    0.355, 'rgba(255,221,78,0.56)', // 1–2,5
    0.4085, 'rgba(255,215,73,0.6)', // 2,5–5
    0.4625, 'rgba(255,207,66,0.65)', // 5–10
    0.53, 'rgba(254,181,55,0.76)', // 10–15
    0.595, 'rgba(222,87,40,0.96)', // 25–50
    0.69, 'rgba(254,156,49,0.84)', // 15–25
    0.81, 'rgba(154,15,38,0.99)' // 75 o més
  ]
};
interface LightningTrack {
  route: string;
  bounds: [number, number, number, number];
  maxzoom: number;
  paint: RasterPaint;
}
const LIGHTNING_TRACKS: Record<'mtg' | 'americas', LightningTrack> = {
  mtg: { route: LIGHTNING_ROUTE, bounds: LIGHTNING_BOUNDS, maxzoom: 8, paint: LIGHTNING_PAINT },
  // 8 km per píxel: per sobre del nivell 7 Mapbox amplia la tessel·la.
  americas: { route: AMERICAS_LIGHTNING_ROUTE, bounds: AMERICAS_LIGHTNING_BOUNDS, maxzoom: 7, paint: AMERICAS_LIGHTNING_PAINT }
};
const lightningTrackOfKey = (key: string) => (key.startsWith(AMERICAS_KEY_PREFIX) ? LIGHTNING_TRACKS.americas : LIGHTNING_TRACKS.mtg);
const lightningSlotOfKey = (key: string) => Number(key.startsWith(AMERICAS_KEY_PREFIX) ? key.slice(AMERICAS_KEY_PREFIX.length) : key);
// Precàrrega més curta que la del radar (el fotograma actual i els 2
// següents, × 3 capes: 2 franges de MTG i 1 d'Amèrica): són tessel·les petites
// i ràpides, i fora del mapa visible una capa no baixa res.
const LIGHTNING_PREFETCH_FRAMES = 2;
const MAX_LIVE_LIGHTNING_LAYERS = (LIGHTNING_PREFETCH_FRAMES + 1) * 3;

// PERF (fluïdesa): les capes HD ("Alta Resolució") no caduquen fins que
// l'API de RainViewer rota el frame de satèl·lit sencer (minuts). Com que
// el "Lazy Load Slider" precarrega frames a mesura que avança la
// reproducció, deixar una agència HD activa durant un cicle complet de
// loop acaba carregant una font+capa per a CADA frame de satèl·lit
// disponible. Amb les 3 agències actives simultàniament això pot arribar a
// desenes de tessel·les d'alta resolució vives alhora — exactament la
// pressió de VRAM que fa que el WebGL context es perdi en dispositius
// limitats (vegeu el listener 'webglcontextlost'). Limitem cada agència a
// una finestra FIFO petita: en afegir-ne una de nova per sobre del límit,
// expulsem la més antiga (mai la que és l'objectiu actual).
const MAX_LIVE_HD_FRAMES_PER_AGENCY = 4;

// CORRECCIÓ (diagnòstic en viu, 2026-10-19): amb Meteosat cada 10 min, cada
// tick de l'animació mostra una capa HD diferent, i una tessel·la freda
// d'EUMETSAT tarda sovint més que els 1,8 s de precàrrega (p50 0,7 s, p95
// 6 s): la capa sortia buida i el satèl·lit parpellejava i desapareixia.
// Ara, mentre la imatge del fotograma no ha arribat (map.isSourceLoaded,
// contrastat amb la xarxa en 15 de 15 casos), es mostra la ja carregada més
// propera en el temps si no és a més d'aquesta distància (el desfasament
// que tenia la capa MSG amb les hores de LibreWXR); si no n'hi ha cap, la
// del fotograma.
const MAX_HD_FALLBACK_SEC = 3600;

// PERF/VRAM: sense límit, un cicle complet de reproducció acaba mantenint
// vives les fonts de tots els fotogrames de radar alhora (mateix problema que
// a l'HD, més amunt). Mateix patró FIFO.
//
// Una sola font de radar per fotograma: la de `radarData` (LibreWXR, o
// RainViewer si LibreWXR no ha donat dades). RainViewer ja no anava per sobre
// de LibreWXR: vegeu useRadarData ("l'animació es veu sobreposada").
const MAX_LIVE_RADAR_FRAMES = 6;

export function useRadarAnimation({
  mapRef,
  overlaysRef,
  currentFrameTimestampRef,
  timeDisplayRef,
  formatTime,
  syncLighting,
  syncAtmosphere,
  styleReadyRef,
  hdTimelineRef,
  gibsTimelineRefs,
  lightningTimelineRef,
  americasLightningTimelineRef
}: UseRadarAnimationProps) {

  const [isPlaying, setIsPlaying] = useState(false);
  const [framesCount, setFramesCount] = useState(0);
  const [currentFrameTimestamp, setCurrentFrameTimestamp] = useState<number | null>(null);

  const isPlayingRef = useRef<boolean>(false);
  const hostRef = useRef<string>('');
  // Línia temporal del reproductor: els timestamps dels fotogrames de radar,
  // en ordre. El camí de cada un (path) es busca a framesByTimeRef.
  const radarFramesRef = useRef<number[]>([]);
  const framesByTimeRef = useRef<Record<number, RadarFrame>>({});
  const satFramesRef = useRef<RadarFrame[]>([]);
  const currentFrameIndexRef = useRef<number>(0);

  const loadedRadarIdsRef = useRef<Record<number, string>>({});
  const loadedSatIdsRef = useRef<Record<number, string>>({});
  const animationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ordre d'inserció dels timestamps de radar carregats (FIFO per al límit
  // MAX_LIVE_RADAR_FRAMES, vegeu ensureFrameLoaded).
  const radarLoadOrderRef = useRef<number[]>([]);

  // Ordre d'inserció de les capes HD vives per agència (claus de HdTarget):
  // FIFO per al límit MAX_LIVE_HD_FRAMES_PER_AGENCY i registre de les capes
  // que existeixen (vegeu ensureFrameLoaded).
  const hdLoadOrderRef = useRef<Record<HdAgency, string[]>>({
    goes: [],
    meteosat: [],
    himawari: []
  });

  // CORRECCIÓ (Fase 3): abans les capes HD només es retiraven quan la
  // pròpia API de RainViewer feia caducar el timestamp (cicle de ~5 min).
  // Si l'usuari feia toggle ON/OFF repetit d'un satèl·lit HD, cada ON creava
  // fonts noves que no es reciclaven fins al següent refresc de dades,
  // acumulant pressió real sobre la VRAM. Ara detectem la transició
  // ON->OFF i alliberem la capa/font immediatament per a l'agència afectada.
  const prevHdEnabledRef = useRef<Record<HdAgency, boolean>>({
    goes: false,
    meteosat: false,
    himawari: false
  });
  // Canvi IR ⇄ color del satèl·lit HD: fora les capes de l'altra variant.
  const prevHdColourRef = useRef<boolean>(false);

  // Franges de llamps vives, en ordre d'inserció (FIFO de
  // MAX_LIVE_LIGHTNING_LAYERS), i si la capa estava activa (alliberament en
  // desactivar-la, com les HD).
  const lightningLoadOrderRef = useRef<string[]>([]);
  const prevLightningEnabledRef = useRef<boolean>(false);

  const isMountedRef = useRef<boolean>(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      loadedRadarIdsRef.current = {};
      loadedSatIdsRef.current = {};
      radarLoadOrderRef.current = [];
    };
  }, []);

  const safeRemoveLayerAndSource = useCallback((map: Map, layerId: string, sourceId: string) => {
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch (e) {
      console.warn(`[Zero Risk] Error atòmic netejant ${layerId} / ${sourceId}:`, e);
    }
  }, []);

  // PERF (fluïdesa): durant la reproducció (cada 600ms) només UNA capa de
  // radar i UNA de satèl·lit/HD deixen de ser el frame actiu i UNA altra ho
  // passa a ser. Abans, cada tick recorria TOTES les capes acumulades
  // (poden arribar a la trentena amb HD actiu) fent 2 mutacions d'estil GL
  // per capa encara que gairebé cap hagués canviat. Aquest ref recorda quin
  // era l'"objectiu" anterior perquè, en mode animació, només toquem els 2
  // que realment canvien. Els canvis provocats per un toggle d'overlay (que
  // sí afecten TOTES les capes d'un tipus, p.ex. mostrar/amagar precip)
  // continuen fent el recorregut complet — vegeu el paràmetre `animationTick`.
  const lastTargetIdsRef = useRef<{ radar: string | null; sat: string | null; hd: Record<HdAgency, string | null>; lightning: string[] }>({
    radar: null,
    sat: null,
    hd: { goes: null, meteosat: null, himawari: null },
    lightning: []
  });

  const isHdReady = useCallback((map: Map, agency: HdAgency, key: string): boolean => {
    const sourceId = hdSourceId(agency, key);
    return !!map.getSource(sourceId) && map.isSourceLoaded(sourceId);
  }, []);

  // Imatge HD ja carregada més propera en el temps a la del fotograma (a
  // igualtat, l'anterior), de la mateixa variant i a MAX_HD_FALLBACK_SEC com
  // a molt; null si no n'hi ha cap.
  const pickReadyHdKey = useCallback((map: Map, agency: HdAgency, target: HdTarget): string | null => {
    let bestKey: string | null = null;
    let bestDistance = Infinity;
    for (const key of hdLoadOrderRef.current[agency]) {
      const [variant, slotStr] = key.split('-');
      if (key === target.key || variant !== target.variant) continue;
      const slot = Number(slotStr);
      if (Math.abs(target.slot - slot) > MAX_HD_FALLBACK_SEC) continue;
      if (!map.getLayer(hdLayerId(agency, key)) || !isHdReady(map, agency, key)) continue;
      const distance = Math.abs(target.slot - slot) + (slot > target.slot ? 1 : 0);
      if (distance < bestDistance) { bestKey = key; bestDistance = distance; }
    }
    return bestKey;
  }, [isHdReady]);

  // Allibera totes les capes/fonts HD d'una agència. Es crida quan l'usuari
  // desactiva l'overlay HD corresponent.
  const pruneHdAgency = useCallback((agency: HdAgency) => {
    const map = mapRef.current;
    if (!map) return;
    hdLoadOrderRef.current[agency].forEach((key) => {
      safeRemoveLayerAndSource(map, hdLayerId(agency, key), hdSourceId(agency, key));
    });
    hdLoadOrderRef.current[agency] = [];
    lastTargetIdsRef.current.hd[agency] = null;
  }, [mapRef, safeRemoveLayerAndSource]);

  // Capa HD que correspon a un fotograma de radar. Cada satèl·lit té hores
  // pròpies cada 10 min: Meteosat alineades amb /hd/meteosat/latest (MTG o
  // MSG), GOES i Himawari amb les franges de GIBS de /hd/{agència}/latest.
  // Mentre no se saben, no se'n crea cap capa.
  const hdTargetFor = useCallback((agency: HdAgency, frameTime: number | null | undefined): HdTarget | null => {
    if (frameTime === null || frameTime === undefined) return null;
    const colour = overlaysRef.current.hdColour;
    if (agency === 'meteosat') {
      const state = hdTimelineRef.current;
      if (state.status === 'idle' || state.status === 'pending') return null;
      const { variant, slot } = computeMeteosatSlot(frameTime, state.timeline, state.nowSec, colour);
      return { key: `${variant}-${slot}`, variant, slot };
    }
    const state = gibsTimelineRefs[agency].current;
    if (state.status === 'idle' || state.status === 'pending') return null;
    const { variant, slot } = computeGibsSlot(frameTime, state.timeline, state.nowSec, colour);
    return { key: `${variant}-${slot}`, variant, slot };
  }, [hdTimelineRef, gibsTimelineRefs, overlaysRef]);

  // Treu les capes HD que ja no necessita cap fotograma de la línia temporal
  // actual (dades de radar noves, o una altra franja/variant).
  const pruneUnneededHd = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    HD_AGENCIES.forEach((agency) => {
      const needed = new Set(radarFramesRef.current.map((t) => hdTargetFor(agency, t)?.key));
      hdLoadOrderRef.current[agency] = hdLoadOrderRef.current[agency].filter((key) => {
        if (needed.has(key)) return true;
        safeRemoveLayerAndSource(map, hdLayerId(agency, key), hdSourceId(agency, key));
        if (lastTargetIdsRef.current.hd[agency] === hdLayerId(agency, key)) lastTargetIdsRef.current.hd[agency] = null;
        return false;
      });
    });
  }, [mapRef, hdTargetFor, safeRemoveLayerAndSource]);

  // Capes de llamps d'un fotograma: les franges de MTG i la finestra
  // d'Amèrica (cap de les dues mentre no se sap la més nova o si la font no
  // està disponible).
  const lightningKeysFor = useCallback((frameTime: number | null | undefined): string[] => {
    if (frameTime === null || frameTime === undefined) return [];
    const keys: string[] = [];
    const mtg = lightningTimelineRef.current;
    if (mtg.status === 'ready' || mtg.status === 'failed') {
      computeLightningSlots(frameTime, mtg.status === 'ready' ? mtg.timeline : undefined, mtg.nowSec).forEach((slot) => keys.push(String(slot)));
    }
    const americas = americasLightningTimelineRef.current;
    if (americas.status === 'ready' || americas.status === 'failed') {
      computeAmericasLightningSlots(frameTime, americas.status === 'ready' ? americas.timeline : undefined, americas.nowSec)
        .forEach((slot) => keys.push(`${AMERICAS_KEY_PREFIX}${slot}`));
    }
    return keys;
  }, [lightningTimelineRef, americasLightningTimelineRef]);

  // Treu les capes de llamps que no necessita cap fotograma (o totes, en
  // desactivar la capa).
  const pruneLightning = useCallback((all: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    const needed = all ? new Set<string>() : new Set(radarFramesRef.current.flatMap((t) => lightningKeysFor(t)));
    lightningLoadOrderRef.current = lightningLoadOrderRef.current.filter((key) => {
      if (needed.has(key)) return true;
      safeRemoveLayerAndSource(map, lightningLayerId(key), lightningSourceId(key));
      return false;
    });
    const live = new Set(lightningLoadOrderRef.current.map(lightningLayerId));
    lastTargetIdsRef.current.lightning = lastTargetIdsRef.current.lightning.filter((id) => live.has(id));
  }, [mapRef, lightningKeysFor, safeRemoveLayerAndSource]);

  // Només destrueix frames quan la pròpia API ens diu que ja han caducat en el temps
  const cleanupExpiredLayers = useCallback((validRadarFrames: RadarFrame[], validSatFrames: RadarFrame[]) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const activeRadarTimes = new Set(validRadarFrames.map(f => f.time));
    const activeSatTimes = new Set(validSatFrames.map(f => f.time));

    Object.keys(loadedRadarIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      if (!activeRadarTimes.has(timestampKey)) {
        const layerId = loadedRadarIdsRef.current[timestampKey];
        const radSourceId = `rad-src-${timestampKey}`;
        safeRemoveLayerAndSource(map, layerId, radSourceId);
        delete loadedRadarIdsRef.current[timestampKey];
        radarLoadOrderRef.current = radarLoadOrderRef.current.filter(t => t !== timestampKey);
      }
    });

    Object.keys(loadedSatIdsRef.current).forEach((key) => {
      const timestampKey = Number(key);
      if (!activeSatTimes.has(timestampKey)) {
        const layerId = loadedSatIdsRef.current[timestampKey];
        const satSourceId = `sat-src-${timestampKey}`;
        safeRemoveLayerAndSource(map, layerId, satSourceId);
        delete loadedSatIdsRef.current[timestampKey];
      }
    });
  }, [mapRef, safeRemoveLayerAndSource, styleReadyRef]);

  const ensureFrameLoaded = useCallback((index: number) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const rFrames = radarFramesRef.current;
    const sFrames = satFramesRef.current;

    if (!rFrames || rFrames.length === 0 || index < 0 || index >= rFrames.length) return;
    const frameTime = rFrames[index];
    if (frameTime === null || frameTime === undefined) return;

    const isTarget = index === currentFrameIndexRef.current;

    // HACK VRAM: 0.000001 força la pre-càrrega a GPU sense ser visible. Evita parpellejos.
    const initialRadOpacity = (isTarget && overlaysRef.current.precip) ? 0.88 : 0.000001;

    const radarFrame = hostRef.current ? framesByTimeRef.current[frameTime] : undefined;

    if (radarFrame) {
      const radSourceId = `rad-src-${frameTime}`;
      const radLayerId = `rad-layer-${frameTime}`;

      if (!loadedRadarIdsRef.current[frameTime] && !map.getSource(radSourceId)) {
        try {
          map.addSource(radSourceId, {
            type: 'raster',
            tiles: [`${hostRef.current}${radarFrame.path}/512/{z}/{x}/{y}/6/${RADAR_TILE_OPTIONS}.png`],
            tileSize: 512,
            // El servidor de RainViewer (si LibreWXR no ha donat dades) no
            // suporta el zoom 8: hi retorna una imatge d'error "Zoom Level
            // Not Supported" en lloc d'una tessel·la transparent. Amb
            // maxzoom 7 Mapbox amplia la del 7 en lloc de demanar-la.
            maxzoom: sampleZoomForHost(hostRef.current),
          });
          map.addLayer({
            id: radLayerId,
            type: 'raster',
            source: radSourceId,
            layout: { visibility: overlaysRef.current.precip ? 'visible' : 'none' },
            paint: {
              'raster-opacity': getRadOpacityExp(initialRadOpacity),
              'raster-opacity-transition': { duration: 0, delay: 0 },
              'raster-fade-duration': 0,
              'raster-resampling': 'linear'
            },
          }, Z_LAYERS.PIS_5B_LIGHTNING);
          loadedRadarIdsRef.current[frameTime] = radLayerId;

          // PERF/VRAM: mateix FIFO que a les agències HD — expulsa el frame
          // més antic si superem el límit (mai el que acabem d'afegir).
          const order = radarLoadOrderRef.current;
          order.push(frameTime);
          while (order.length > MAX_LIVE_RADAR_FRAMES) {
            const oldestTs = order[0];
            if (oldestTs === frameTime) break;
            order.shift();
            safeRemoveLayerAndSource(map, `rad-layer-${oldestTs}`, `rad-src-${oldestTs}`);
            delete loadedRadarIdsRef.current[oldestTs];
          }
        } catch (e) {
          console.warn(`[Zero Risk] Error afegint radar ${radLayerId}:`, e);
        }
      }
    }

    if (sFrames && sFrames.length > 0) {
      let closestSatIdx = 0;
      let minDiff = Infinity;
      sFrames.forEach((sFrame, sIdx) => {
        if (!sFrame || sFrame.time === null) return;
        const diff = Math.abs(sFrame.time - frameTime);
        if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
      });

      const sFrame = sFrames[closestSatIdx];
      if (sFrame && sFrame.time !== null) {
        const timestamp = sFrame.time;
        const satSourceId = `sat-src-${timestamp}`;
        const satLayerId = `sat-layer-${timestamp}`;

        if (!loadedSatIdsRef.current[timestamp] && !map.getSource(satSourceId)) {
          const rvHostEnc = encodeURIComponent(hostRef.current);
          const rvPathEnc = encodeURIComponent(sFrame.path);

          try {
            map.addSource(satSourceId, {
              type: 'raster',
              tiles: [`${SAT_PROXY_HOST}/sat/{z}/{x}/{y}.png?host=${rvHostEnc}&path=${rvPathEnc}`],
              tileSize: 512,
              maxzoom: 6
            });

            // Mateixa regla que `showSat` a applyFrameVisibility: amb un
            // satèl·lit HD actiu, l'IR global també es dibuixa (fora de la
            // zona HD). Si la capa nasqués amagada, el camí lleuger de
            // l'animació no la mostraria fins al tick en què és l'objectiu,
            // sense haver precarregat les tessel·les.
            const o = overlaysRef.current;
            const showSat = o.satIR || o.hdGoes || o.hdMeteosat || o.hdHimawari;
            const targetSatOpacity = (isTarget && showSat) ? 0.85 : 0.000001;

            map.addLayer({
              id: satLayerId,
              type: 'raster',
              source: satSourceId,
              layout: { visibility: showSat ? 'visible' : 'none' },
              paint: {
                'raster-opacity': getSatOpacityExp(targetSatOpacity),
                'raster-opacity-transition': { duration: 0, delay: 0 },
                'raster-contrast': 0.25,
                'raster-saturation': -1.0,
                'raster-resampling': 'linear',
                'raster-fade-duration': 0
              },
            }, Z_LAYERS.PIS_4_FILTER);

            loadedSatIdsRef.current[timestamp] = satLayerId;
          } catch (e) {
            console.warn(`[Zero Risk] Error afegint satèl·lit ${satLayerId}:`, e);
          }
        }
      }
    }

    // Capes HD: independents de la llista de satèl·lit de LibreWXR (cada
    // satèl·lit té hores pròpies; si LibreWXR cau, la capa HD continua).
    HD_AGENCIES.forEach((agency) => {
      if (!isHdEnabled(overlaysRef.current, agency)) return;
      const target = hdTargetFor(agency, frameTime);
      if (!target) return;
      const sourceId = hdSourceId(agency, target.key);
      const layerId = hdLayerId(agency, target.key);
      if (map.getSource(sourceId)) return;

      // Diversos fotogrames poden compartir franja: és visible si és la del
      // fotograma actual, encara que s'estigui precarregant per a un altre.
      const currentKey = hdTargetFor(agency, rFrames[currentFrameIndexRef.current])?.key;
      const cfg = HD_VARIANTS[target.variant];

      try {
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [`${SAT_PROXY_HOST}/${hdRoute(target.variant, agency)}/${target.slot}/{z}/{x}/{y}.png`],
          tileSize: cfg.tileSize ?? 512,
          bounds: cfg.bounds ?? HD_BOUNDS[agency],
          minzoom: cfg.minzoom ?? 2,
          maxzoom: cfg.maxzoom ?? 8
        });

        map.addLayer({
          id: layerId,
          type: 'raster',
          source: sourceId,
          layout: { visibility: 'visible' },
          paint: {
            'raster-opacity': hdOpacityExp(target.key, target.key === currentKey ? 1.0 : 0.000001),
            'raster-opacity-transition': { duration: 0, delay: 0 },
            'raster-saturation': cfg.saturation,
            'raster-contrast': cfg.contrast,
            'raster-brightness-min': cfg.brightnessMin,
            'raster-fade-duration': 0
          },
        }, cfg.colour ? Z_LAYERS.PIS_5_HIGH_ATMOS : Z_LAYERS.PIS_4_FILTER);

        // PERF: finestra FIFO — expulsa la capa HD més antiga d'aquesta
        // agència si ja n'hi ha MAX_LIVE_HD_FRAMES_PER_AGENCY vives, mai la
        // que s'acaba d'afegir ni la del fotograma actual. Si la del
        // fotograma actual encara no ha arribat, la que es veu ara tampoc
        // (l'animació la manté mentrestant) i el límit en compta una més.
        const shownId = lastTargetIdsRef.current.hd[agency];
        const keepShown = !!shownId && !!currentKey && shownId !== hdLayerId(agency, currentKey) && !isHdReady(map, agency, currentKey);
        const isProtected = (k: string) => k === target.key || k === currentKey || (keepShown && hdLayerId(agency, k) === shownId);
        const order = hdLoadOrderRef.current[agency];
        order.push(target.key);
        while (order.length > MAX_LIVE_HD_FRAMES_PER_AGENCY + (keepShown ? 1 : 0)) {
          const victimIdx = order.findIndex((k) => !isProtected(k));
          if (victimIdx < 0) break;
          const [victim] = order.splice(victimIdx, 1);
          safeRemoveLayerAndSource(map, hdLayerId(agency, victim), hdSourceId(agency, victim));
        }
      } catch (e) {
        console.warn(`[Zero Risk] Error afegint HD satèl·lit ${layerId}:`, e);
      }
    });

    // Llamps: les franges del fotograma (MTG i Amèrica), per sobre del radar
    // (just sota les etiquetes; el radar va sota PIS_5B_LIGHTNING).
    const framesAhead = (index - currentFrameIndexRef.current + rFrames.length) % rFrames.length;
    if (overlaysRef.current.lightning && framesAhead <= LIGHTNING_PREFETCH_FRAMES) {
      const keys = lightningKeysFor(frameTime);
      const currentKeys = lightningKeysFor(rFrames[currentFrameIndexRef.current]);
      keys.forEach((key) => {
        const sourceId = lightningSourceId(key);
        if (map.getSource(sourceId)) return;
        const track = lightningTrackOfKey(key);
        try {
          map.addSource(sourceId, {
            type: 'raster',
            tiles: [`${SAT_PROXY_HOST}/${track.route}/${lightningSlotOfKey(key)}/{z}/{x}/{y}.png`],
            tileSize: 512,
            bounds: track.bounds,
            minzoom: 2,
            maxzoom: track.maxzoom
          });
          map.addLayer({
            id: lightningLayerId(key),
            type: 'raster',
            source: sourceId,
            layout: { visibility: 'visible' },
            paint: {
              ...track.paint,
              'raster-opacity': currentKeys.includes(key) ? LIGHTNING_OPACITY : 0.000001,
              'raster-opacity-transition': { duration: 0, delay: 0 },
              'raster-fade-duration': 0
            },
          }, Z_LAYERS.PIS_6_UI);

          // FIFO: mai la franja que s'acaba d'afegir ni les del fotograma actual.
          const order = lightningLoadOrderRef.current;
          order.push(key);
          while (order.length > MAX_LIVE_LIGHTNING_LAYERS) {
            const victimIdx = order.findIndex((k) => k !== key && !currentKeys.includes(k));
            if (victimIdx < 0) break;
            const [victim] = order.splice(victimIdx, 1);
            safeRemoveLayerAndSource(map, lightningLayerId(victim), lightningSourceId(victim));
          }
        } catch (e) {
          console.warn(`[Zero Risk] Error afegint llamps ${key}:`, e);
        }
      });
    }
  }, [mapRef, overlaysRef, safeRemoveLayerAndSource, styleReadyRef, hdTargetFor, isHdReady, lightningKeysFor]);

  // CORRECCIÓ: quan el dispositiu perd el context WebGL, useMapLifecycle
  // destrueix el mapa i en crea un de nou, però aquest hook no es remunta:
  // els registres de capes "ja carregades" seguien plens amb les del mapa
  // destruït i ensureFrameLoaded no tornava a afegir el radar ni l'IR global
  // (només l'HD, que comprova map.getSource). Es buiden en crear un mapa nou;
  // les línies temporals (frames) continuen sent vàlides.
  const resetLayerBookkeeping = useCallback(() => {
    loadedRadarIdsRef.current = {};
    loadedSatIdsRef.current = {};
    radarLoadOrderRef.current = [];
    hdLoadOrderRef.current = { goes: [], meteosat: [], himawari: [] };
    prevHdEnabledRef.current = { goes: false, meteosat: false, himawari: false };
    lightningLoadOrderRef.current = [];
    prevLightningEnabledRef.current = false;
    lastTargetIdsRef.current = { radar: null, sat: null, hd: { goes: null, meteosat: null, himawari: null }, lightning: [] };
  }, []);

  const applyFrameVisibility = useCallback((index: number, animationTick: boolean = false) => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const rFramesCount = radarFramesRef.current.length;
    if (rFramesCount === 0) return;

    const safeIndex = (index % rFramesCount + rFramesCount) % rFramesCount;

    // Lazy Load Slider: Ens assegurem que els propers 4 frames estiguin injectats a Mapbox
    // (Un cop injectats NO s'eliminen fins que l'API els caduca, solucionant el parpelleig al fer loops)
    const activeIndices = [
      safeIndex,
      (safeIndex + 1) % rFramesCount,
      (safeIndex + 2) % rFramesCount,
      (safeIndex + 3) % rFramesCount
    ];
    activeIndices.forEach(idx => ensureFrameLoaded(idx));

    // CORRECCIÓ (Fase 3): detecció de transició ON->OFF per agència HD i
    // alliberament immediat de VRAM (veure pruneHdAgency més amunt).
    HD_AGENCIES.forEach((agency) => {
      const isEnabledNow = isHdEnabled(overlaysRef.current, agency);
      const wasEnabled = prevHdEnabledRef.current[agency];

      if (wasEnabled && !isEnabledNow) {
        pruneHdAgency(agency);
      }
      prevHdEnabledRef.current[agency] = isEnabledNow;
    });

    // IR ⇄ color: les capes de l'altra variant ja no les necessita cap
    // fotograma (les del mode nou s'acaben de crear a ensureFrameLoaded).
    if (overlaysRef.current.hdColour !== prevHdColourRef.current) {
      prevHdColourRef.current = overlaysRef.current.hdColour;
      pruneUnneededHd();
    }

    const lightningEnabled = overlaysRef.current.lightning;
    if (prevLightningEnabledRef.current && !lightningEnabled) pruneLightning(true);
    prevLightningEnabledRef.current = lightningEnabled;

    const currentFrameTime = radarFramesRef.current[safeIndex];
    const targetRadarId = currentFrameTime !== null && currentFrameTime !== undefined
      ? loadedRadarIdsRef.current[currentFrameTime]
      : undefined;

    if (currentFrameTime !== null && currentFrameTime !== undefined) {
      if (timeDisplayRef.current) {
         timeDisplayRef.current.textContent = formatTime(currentFrameTime);
      }
      setCurrentFrameTimestamp(currentFrameTime);
      currentFrameTimestampRef.current = currentFrameTime;

      if (!isPlayingRef.current) {
        syncLighting(currentFrameTime * 1000);
        syncAtmosphere();
      }
    }

    const showPrecip = overlaysRef.current.precip;
    const hasAnyHdEnabled = overlaysRef.current.hdGoes || overlaysRef.current.hdMeteosat || overlaysRef.current.hdHimawari;
    const showSat = overlaysRef.current.satIR || hasAnyHdEnabled; // HD i IR van de la mà asíncrona

    // Aplicació d'Opacitats GPU sense desmuntar capes
    if (animationTick) {
      // Mode lleuger: només l'objectiu anterior (s'apaga) i el nou (s'encén).
      const prevRadarId = lastTargetIdsRef.current.radar;
      if (prevRadarId && prevRadarId !== targetRadarId && map.getLayer(prevRadarId)) {
        map.setPaintProperty(prevRadarId, 'raster-opacity', showPrecip ? getRadOpacityExp(0.000001) : 0);
      }
      if (targetRadarId && map.getLayer(targetRadarId)) {
        map.setLayoutProperty(targetRadarId, 'visibility', showPrecip ? 'visible' : 'none');
        map.setPaintProperty(targetRadarId, 'raster-opacity', showPrecip ? getRadOpacityExp(0.88) : 0);
      }
    } else {
      Object.values(loadedRadarIdsRef.current).forEach((id) => {
        if (id && map.getLayer(id)) {
          const isTarget = id === targetRadarId;
          const targetOpacity = isTarget ? 0.88 : 0.000001;

          map.setLayoutProperty(id, 'visibility', showPrecip ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', showPrecip ? getRadOpacityExp(targetOpacity) : 0);
        }
      });
    }
    lastTargetIdsRef.current.radar = targetRadarId ?? null;

    if (satFramesRef.current.length > 0 && currentFrameTime !== null && currentFrameTime !== undefined) {
      let closestSatIdx = 0;
      let minDiff = Infinity;
      satFramesRef.current.forEach((sFrame, sIdx) => {
        if (!sFrame || sFrame.time === null) return;
        const diff = Math.abs(sFrame.time - currentFrameTime);
        if (diff < minDiff) { minDiff = diff; closestSatIdx = sIdx; }
      });

      const sFrame = satFramesRef.current[closestSatIdx];
      const targetSatId = sFrame?.time ? loadedSatIdsRef.current[sFrame.time] : undefined;

      if (animationTick) {
        const prevSatId = lastTargetIdsRef.current.sat;
        if (prevSatId && prevSatId !== targetSatId && map.getLayer(prevSatId)) {
          map.setPaintProperty(prevSatId, 'raster-opacity', showSat ? getSatOpacityExp(0.000001) : 0);
        }
        if (targetSatId && map.getLayer(targetSatId)) {
          map.setLayoutProperty(targetSatId, 'visibility', showSat ? 'visible' : 'none');
          map.setPaintProperty(targetSatId, 'raster-opacity', showSat ? getSatOpacityExp(0.85) : 0);
        }
      } else {
        Object.values(loadedSatIdsRef.current).forEach((id) => {
          if (!id || !map.getLayer(id)) return;
          const targetOpacity = id === targetSatId ? 0.85 : 0.000001;
          map.setLayoutProperty(id, 'visibility', showSat ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', showSat ? getSatOpacityExp(targetOpacity) : 0);
        });
      }
      lastTargetIdsRef.current.sat = targetSatId ?? null;
    }

    // HD: la capa de la franja del fotograma actual a opacitat plena, les
    // altres precarregades (0.000001). Reproduint, si la del fotograma actual
    // encara no ha arribat, es mostra la imatge ja carregada més propera en
    // el temps (vegeu MAX_HD_FALLBACK_SEC); si no n'hi ha cap, la del
    // fotograma. En pausa, sempre la del fotograma exacte.
    HD_AGENCIES.forEach((agency) => {
      const enabled = isHdEnabled(overlaysRef.current, agency);
      const target = enabled ? hdTargetFor(agency, currentFrameTime) : null;
      const newHdId = target ? hdLayerId(agency, target.key) : null;
      const shownId = lastTargetIdsRef.current.hd[agency];
      const heldKey = (animationTick || isPlayingRef.current) && target && !isHdReady(map, agency, target.key)
        ? pickReadyHdKey(map, agency, target)
        : null;
      const displayKey = heldKey ?? target?.key ?? null;
      const displayId = heldKey ? hdLayerId(agency, heldKey) : newHdId;

      if (animationTick) {
        const shownKey = shownId ? shownId.slice(`hd-${agency}-layer-`.length) : null;
        if (shownId && shownKey && shownId !== displayId && map.getLayer(shownId)) {
          map.setPaintProperty(shownId, 'raster-opacity', hdOpacityExp(shownKey, 0.000001));
        }
        if (displayId && displayKey && map.getLayer(displayId)) {
          map.setLayoutProperty(displayId, 'visibility', 'visible');
          map.setPaintProperty(displayId, 'raster-opacity', hdOpacityExp(displayKey, 1.0));
        }
      } else {
        hdLoadOrderRef.current[agency].forEach((key) => {
          const id = hdLayerId(agency, key);
          if (!map.getLayer(id)) return;
          map.setLayoutProperty(id, 'visibility', enabled ? 'visible' : 'none');
          map.setPaintProperty(id, 'raster-opacity', enabled ? hdOpacityExp(key, id === displayId ? 1.0 : 0.000001) : 0);
        });
      }
      lastTargetIdsRef.current.hd[agency] = displayId;
    });

    // Llamps: les dues franges del fotograma a opacitat plena, la resta
    // precarregades. Sense "reserva" com l'HD: si una franja encara no ha
    // arribat, millor cap llamp que llamps d'una altra hora.
    const lightningIds = lightningEnabled
      ? lightningKeysFor(currentFrameTime).map(lightningLayerId).filter((id) => !!map.getLayer(id))
      : [];
    if (animationTick) {
      lastTargetIdsRef.current.lightning.forEach((id) => {
        if (!lightningIds.includes(id) && map.getLayer(id)) map.setPaintProperty(id, 'raster-opacity', 0.000001);
      });
      lightningIds.forEach((id) => {
        map.setLayoutProperty(id, 'visibility', 'visible');
        map.setPaintProperty(id, 'raster-opacity', LIGHTNING_OPACITY);
      });
    } else {
      lightningLoadOrderRef.current.forEach((key) => {
        const id = lightningLayerId(key);
        if (!map.getLayer(id)) return;
        map.setLayoutProperty(id, 'visibility', lightningEnabled ? 'visible' : 'none');
        map.setPaintProperty(id, 'raster-opacity', lightningIds.includes(id) ? LIGHTNING_OPACITY : lightningEnabled ? 0.000001 : 0);
      });
    }
    lastTargetIdsRef.current.lightning = lightningIds;
  }, [ensureFrameLoaded, formatTime, mapRef, overlaysRef, syncAtmosphere, syncLighting, currentFrameTimestampRef, timeDisplayRef, pruneHdAgency, pruneUnneededHd, pruneLightning, styleReadyRef, hdTargetFor, isHdReady, pickReadyHdKey, lightningKeysFor]);

  // /hd/meteosat/latest o /hd/{goes|himawari}/latest han canviat (primera
  // resposta, franja nova o una altra capa): fora les capes que ja no toquen i
  // es creen les que falten.
  const refreshHdTimeline = useCallback(() => {
    pruneUnneededHd();
    applyFrameVisibility(currentFrameIndexRef.current);
  }, [pruneUnneededHd, applyFrameVisibility]);

  // El mateix per a /lightning/latest.
  const refreshLightningTimeline = useCallback(() => {
    pruneLightning(false);
    applyFrameVisibility(currentFrameIndexRef.current);
  }, [pruneLightning, applyFrameVisibility]);

  const injectLayersIntoMap = useCallback((parsedData: z.infer<typeof RainViewerResponseSchema>) => {
    const map = mapRef.current;
    if (!map) return;

    const { host, radar, satellite } = parsedData;
    // Si canvia el proveïdor (LibreWXR ⇄ RainViewer), fora totes les capes de
    // l'anterior: les claus són només el timestamp i, amb la mateixa hora, el
    // fotograma de l'altre quedaria amb l'altra paleta enmig de l'animació.
    const hostChanged = hostRef.current !== '' && hostRef.current !== host;
    hostRef.current = host;

    const frames = (radar?.past || []).filter(f => f && f.time !== null);
    framesByTimeRef.current = {};
    frames.forEach((f) => { framesByTimeRef.current[f.time!] = f; });
    const times = Object.keys(framesByTimeRef.current).map(Number).sort((a, b) => a - b);

    const sFrames = (satellite?.infrared || []).filter(f => f && f.time !== null);

    radarFramesRef.current = times;
    satFramesRef.current = sFrames;
    setFramesCount(times.length);

    cleanupExpiredLayers(hostChanged ? [] : frames, sFrames);
    pruneUnneededHd();
    pruneLightning(false);

    if (times.length === 0) return;

    const initialIdx = Math.max(0, times.length - 1);
    currentFrameIndexRef.current = initialIdx;

    ensureFrameLoaded(initialIdx);
    if (times.length > 1) {
      setTimeout(() => {
        if (isMountedRef.current) ensureFrameLoaded(0);
      }, 100);
    }

    if (styleReadyRef.current) {
      applyFrameVisibility(currentFrameIndexRef.current);
    } else {
      // CORRECCIÓ: `once('load', ...)` en lloc de `once('idle', ...)` —
      // vegeu styleReadyRef a useMapLifecycle.ts.
      map.once('load', () => {
        if (isMountedRef.current) applyFrameVisibility(currentFrameIndexRef.current);
      });
    }
  }, [ensureFrameLoaded, applyFrameVisibility, cleanupExpiredLayers, pruneUnneededHd, pruneLightning, mapRef, styleReadyRef]);

  const togglePlay = useCallback(() => {
    if (radarFramesRef.current.length === 0) return;
    const nextPlayState = !isPlayingRef.current;
    setIsPlaying(nextPlayState);
    isPlayingRef.current = nextPlayState;

    if (nextPlayState) {
      currentFrameIndexRef.current = 0;
      applyFrameVisibility(0);
    } else {
      applyFrameVisibility(currentFrameIndexRef.current);
    }
  }, [applyFrameVisibility]);

  // Pausa des de fora (p. ex. en passar a la pestanya de vent). Ha d'actualitzar
  // també isPlayingRef: togglePlay decideix a partir de la ref, i si quedava a
  // true el primer clic a Play en tornar al radar tornava a "pausar".
  const pausePlayback = useCallback(() => {
    if (!isPlayingRef.current) return;
    isPlayingRef.current = false;
    setIsPlaying(false);
    applyFrameVisibility(currentFrameIndexRef.current);
  }, [applyFrameVisibility]);

  const setAnimationActive = useCallback((active: boolean) => {
    if (active && isPlayingRef.current && radarFramesRef.current.length > 0) {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
      animationTimerRef.current = setInterval(() => {
        if (!isMountedRef.current) return;
        const totalFrames = radarFramesRef.current.length;
        if (totalFrames === 0) return;
        const nextIndex = (currentFrameIndexRef.current + 1) % totalFrames;
        currentFrameIndexRef.current = nextIndex;
        applyFrameVisibility(nextIndex, true);
      }, 600);
    } else {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    }
  }, [applyFrameVisibility]);

  return {
    isPlaying,
    pausePlayback,
    isPlayingRef,
    framesCount,
    currentFrameTimestamp,
    injectLayersIntoMap,
    togglePlay,
    setAnimationActive,
    applyFrameVisibility,
    refreshHdTimeline,
    refreshLightningTimeline,
    resetLayerBookkeeping,
    radarFramesRef,
    currentFrameIndexRef
  };
}