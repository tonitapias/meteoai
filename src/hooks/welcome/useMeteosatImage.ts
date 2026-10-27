// src/hooks/welcome/useMeteosatImage.ts
// La foto de l'última parada de l'ascensor de la benvinguda: la Terra sencera tal com la veu ara el Meteosat-12
// (GeoColour d'EUMETSAT: color real de dia i infraroig de nit). EUMETSAT la serveix ja projectada com la veu el
// satèl·lit (ortogràfica centrada a 0°, 0°), anònima i amb CORS, en un JPEG de ~70 KB.
import { useEffect, useState } from 'react';
import { fetchWithTimeout } from '../../utils/networkUtils';
import { latestImageTime } from '../../utils/welcome/skyElevator';

const LAYER = 'mtg_fd:rgb_geocolour';
const CAPS_URL = 'https://view.eumetsat.int/geoserver/mtg_fd/rgb_geocolour/ows?service=WMS&version=1.3.0&request=GetCapabilities';
const IMAGE_PX = 720;
/** Mitja amplada del quadre demanat (m): una mica més que el radi de la Terra perquè el limbe hi càpiga sencer. */
const HALF_EXTENT = 6_400_000;
const EARTH_RADIUS = 6_378_137;
/** Part de la imatge que ocupa el disc de la Terra. */
export const DISC_FILL = EARTH_RADIUS / HALF_EXTENT;
const CAPS_TIMEOUT_MS = 8000;

const imageUrl = (time: number | null) =>
  `https://view.eumetsat.int/geoserver/wms?service=WMS&version=1.3.0&request=GetMap&layers=${LAYER}&styles=`
  + `&crs=AUTO:42003,9001,0,0&bbox=-${HALF_EXTENT},-${HALF_EXTENT},${HALF_EXTENT},${HALF_EXTENT}`
  + `&width=${IMAGE_PX}&height=${IMAGE_PX}&format=image/jpeg${time === null ? '' : `&time=${new Date(time).toISOString()}`}`;

export type MeteosatImage =
  | { status: 'loading' }
  | { status: 'ready'; src: string; /** Minuts que té la imatge, si se n'ha pogut llegir l'hora. */ ageMinutes: number | null }
  | { status: 'failed' };

/**
 * La imatge més nova: primer les capacitats de la capa (6 KB) per saber-ne l'hora, i després la imatge d'aquella hora,
 * que es descarrega d'amagat perquè quan s'hi arribi ja sigui a punt.
 */
export function useMeteosatImage(): MeteosatImage {
  const [state, setState] = useState<MeteosatImage>({ status: 'loading' });
  useEffect(() => {
    let alive = true;
    let img: HTMLImageElement | null = null;
    (async () => {
      let time: number | null = null;
      try {
        const response = await fetchWithTimeout(CAPS_URL, CAPS_TIMEOUT_MS);
        if (response.ok) time = latestImageTime(await response.text());
      } catch { /* sense l'hora: es demana la imatge per defecte, que també és la més nova */ }
      if (!alive) return;
      const src = imageUrl(time);
      img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        if (alive) setState({ status: 'ready', src, ageMinutes: time === null ? null : Math.round((Date.now() - time) / 60000) });
      };
      img.onerror = () => { if (alive) setState({ status: 'failed' }); };
      img.src = src;
    })();
    return () => {
      alive = false;
      if (img) { img.onload = null; img.onerror = null; }
    };
  }, []);
  return state;
}
