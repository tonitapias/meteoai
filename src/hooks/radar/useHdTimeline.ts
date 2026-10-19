import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import { fetchWithTimeout } from '../../utils/networkUtils';
import {
  HdTimelineSchema,
  LightningLatestSchema,
  SAT_PROXY_HOST,
  type HdTimeline,
  type LightningLatest
} from '../../utils/radarPhysics';

// Franges pròpies d'una capa del worker: el worker diu quina és l'última
// imatge publicada (/hd/meteosat/latest per a "Meteosat HD (Europa)",
// /lightning/latest per als llamps; desat 60 s a l'edge). useRadarAnimation
// hi alinea cada fotograma de radar (computeMeteosatSlot, computeLightningSlots).
export interface SlotTimelineState<T> {
  // 'pending': encara no se sap la franja; les capes s'esperen (uns
  // 0,1–0,3 s) en lloc de baixar tessel·les que s'haurien de llençar.
  // 'failed': sense /latest, hora calculada (ara − 30 min).
  status: 'idle' | 'pending' | 'ready' | 'failed';
  timeline: T | null;
  // Rellotge de l'hora calculada: fix entre refrescos perquè els fotogrames
  // d'un mateix bucle no canviïn de franja.
  nowSec: number;
}
export type HdTimelineState = SlotTimelineState<HdTimeline>;
export type LightningTimelineState = SlotTimelineState<LightningLatest>;

// La resposta porta `Cache-Control: max-age=60`: obrir i tancar el radar en
// menys d'un minut surt de la memòria cau HTTP del navegador.
const HD_LATEST_URL = `${SAT_PROXY_HOST}/hd/meteosat/latest`;
const LIGHTNING_LATEST_URL = `${SAT_PROXY_HOST}/lightning/latest`;
const FETCH_TIMEOUT_MS = 3000;
const REFRESH_MS = 5 * 60 * 1000;

type Loaded<T> = { ok: true; value: T } | { ok: false };

async function loadLatest<T>(url: string, schema: z.ZodType<T>): Promise<Loaded<T>> {
  try {
    const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      console.error(`[Zod Validation Error] ${url} ha canviat el format:`, parsed.error.format());
      return { ok: false };
    }
    return { ok: true, value: parsed.data };
  } catch (err: unknown) {
    console.warn(`[Network] Fallada contactant ${url}, hora calculada:`, err);
    return { ok: false };
  }
}

function useSlotTimeline<T>(enabled: boolean, url: string, schema: z.ZodType<T>) {
  const timelineRef = useRef<SlotTimelineState<T>>({ status: 'idle', timeline: null, nowSec: 0 });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    if (timelineRef.current.status === 'idle') timelineRef.current = { ...timelineRef.current, status: 'pending' };

    const update = async () => {
      const loaded = await loadLatest(url, schema);
      if (cancelled) return;
      const prev = timelineRef.current;
      // Sense canvis (mateixa resposta): no es torna a calcular res.
      if (loaded.ok && prev.status === 'ready' && JSON.stringify(prev.timeline) === JSON.stringify(loaded.value)) return;
      timelineRef.current = loaded.ok
        ? { status: 'ready', timeline: loaded.value, nowSec: Math.floor(Date.now() / 1000) }
        : { status: 'failed', timeline: null, nowSec: Math.floor(Date.now() / 1000) };
      setVersion((v) => v + 1);
    };

    void update();
    const id = setInterval(() => { void update(); }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, url, schema]);

  return { timelineRef, version };
}

export function useHdTimeline(enabled: boolean) {
  return useSlotTimeline<HdTimeline>(enabled, HD_LATEST_URL, HdTimelineSchema);
}

export function useLightningTimeline(enabled: boolean) {
  return useSlotTimeline<LightningLatest>(enabled, LIGHTNING_LATEST_URL, LightningLatestSchema);
}
