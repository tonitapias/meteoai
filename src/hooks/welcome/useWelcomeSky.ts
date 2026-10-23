// src/hooks/welcome/useWelcomeSky.ts
// Cel de la benvinguda per al lloc on és el dispositiu: de sortida, la ciutat de la seva zona horària; si
// l'usuari ja havia donat permís d'ubicació, la posició real (precisió baixa, sense preguntar res). Es
// recalcula cada minut i en tornar a la pestanya: el cel canvia a poc a poc i no cal cap animació contínua.
import { useEffect, useMemo, useState } from 'react';
import { computeWelcomeSky, placeFromTimeZone, SkyPlace, WelcomeSky } from '../../utils/welcome/welcomeSky';
import type { GeoPermission } from './useGeoPermission';

function deviceTimeZonePlace(): SkyPlace {
  let timeZone: string | undefined;
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timeZone = undefined;
  }
  // Desfasament estàndard (sense horari d'estiu): el més petit dels de gener i juliol, en minuts per davant d'UTC.
  const year = new Date().getFullYear();
  const std = -Math.max(new Date(year, 0, 1).getTimezoneOffset(), new Date(year, 6, 1).getTimezoneOffset());
  return placeFromTimeZone(timeZone, std);
}

export function useWelcomeSky(permission: GeoPermission): { sky: WelcomeSky; now: Date } {
  const [now, setNow] = useState(() => new Date());
  const [gpsPlace, setGpsPlace] = useState<SkyPlace | null>(null);
  const tzPlace = useMemo(() => deviceTimeZonePlace(), []);

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  useEffect(() => {
    if (permission !== 'granted' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      pos => {
        if (!cancelled) setGpsPlace({ lat: pos.coords.latitude, lon: pos.coords.longitude, source: 'gps' });
      },
      () => { /* sense posició: es queda la de la zona horària */ },
      { enableHighAccuracy: false, maximumAge: 30 * 60000, timeout: 10000 },
    );
    return () => { cancelled = true; };
  }, [permission]);

  const sky = useMemo(() => computeWelcomeSky(now, gpsPlace ?? tzPlace), [now, gpsPlace, tzPlace]);
  return { sky, now };
}
