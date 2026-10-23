// src/hooks/welcome/useGeoPermission.ts
// Estat del permís d'ubicació sense demanar-lo: la benvinguda el fa servir per no oferir un botó que
// fallarà (permís denegat) i per afinar el cel amb la posició real quan ja està concedit.
import { useEffect, useState } from 'react';

export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

const isUnsupported = () => typeof navigator !== 'undefined' && !('geolocation' in navigator);

export function useGeoPermission(): GeoPermission {
  const [state, setState] = useState<GeoPermission>(() => (isUnsupported() ? 'unsupported' : 'unknown'));

  useEffect(() => {
    if (isUnsupported()) return;
    const perms = typeof navigator !== 'undefined' ? navigator.permissions : undefined;
    // Safari antic i alguns WebView no tenen l'API: queda 'unknown' i el botó funciona com sempre.
    if (!perms?.query) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;
    const sync = () => { if (!cancelled && status) setState(status.state as GeoPermission); };
    perms.query({ name: 'geolocation' as PermissionName })
      .then(s => { status = s; sync(); s.addEventListener('change', sync); })
      .catch(() => { /* navegadors que no reconeixen 'geolocation' a l'API */ });
    return () => {
      cancelled = true;
      status?.removeEventListener('change', sync);
    };
  }, []);

  return state;
}
