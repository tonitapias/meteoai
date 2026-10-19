import { useEffect, useRef, useState } from 'react';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { HdTimelineSchema, SAT_PROXY_HOST, type HdTimeline } from '../../utils/radarPhysics';

// Franges de la capa "Meteosat HD (Europa)": el worker diu quina capa fa
// servir (MTG, o MSG de reserva) i quina és l'última imatge publicada
// (/hd/meteosat/latest, desat 60 s a l'edge). useRadarAnimation hi alinea
// cada fotograma de radar (computeMeteosatSlot).
export interface HdTimelineState {
  // 'pending': encara no se sap la capa; les capes Meteosat HD s'esperen
  // (uns 0,1–0,3 s) en lloc de baixar tessel·les que s'haurien de llençar.
  // 'failed': sense /latest, hora calculada (ara − 30 min) amb MTG.
  status: 'idle' | 'pending' | 'ready' | 'failed';
  timeline: HdTimeline | null;
  // Rellotge de l'hora calculada: fix entre refrescos perquè els fotogrames
  // d'un mateix bucle no canviïn de franja.
  nowSec: number;
}

// La resposta porta `Cache-Control: max-age=60`: obrir i tancar el radar en
// menys d'un minut surt de la memòria cau HTTP del navegador.
const LATEST_URL = `${SAT_PROXY_HOST}/hd/meteosat/latest`;
const FETCH_TIMEOUT_MS = 3000;
const REFRESH_MS = 5 * 60 * 1000;

async function loadTimeline(): Promise<HdTimeline | null> {
  try {
    const response = await fetchWithTimeout(LATEST_URL, FETCH_TIMEOUT_MS);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = HdTimelineSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.error('[Zod Validation Error] /hd/meteosat/latest ha canviat el format:', parsed.error.format());
      return null;
    }
    return parsed.data;
  } catch (err: unknown) {
    console.warn('[Network] Fallada contactant /hd/meteosat/latest, hora calculada:', err);
    return null;
  }
}

export function useHdTimeline(enabled: boolean) {
  const timelineRef = useRef<HdTimelineState>({ status: 'idle', timeline: null, nowSec: 0 });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (timelineRef.current.status === 'idle') timelineRef.current = { ...timelineRef.current, status: 'pending' };

    const update = async () => {
      const timeline = await loadTimeline();
      if (cancelled) return;
      const prev = timelineRef.current;
      if (timeline && prev.status === 'ready' && prev.timeline?.layer === timeline.layer && prev.timeline.latest === timeline.latest) return;
      timelineRef.current = { status: timeline ? 'ready' : 'failed', timeline, nowSec: Math.floor(Date.now() / 1000) };
      setVersion((v) => v + 1);
    };

    void update();
    const id = setInterval(() => { void update(); }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  return { timelineRef, version };
}
