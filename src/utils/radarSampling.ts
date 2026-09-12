// src/utils/radarSampling.ts
//
// Mostreig puntual del radar: donat un lat/lon, llegim el píxel exacte de la
// tessel·la PNG de radar (sense muntar cap mapa) i el traduïm a una
// estimació de precipitació. Serveix per detectar quan el radar veu pluja
// real que el model no preveu (useRadarRealityCheck.ts).

// Taula oficial dBZ -> RGBA de l'esquema "NEXRAD Level III" (id 6 a l'API de
// RainViewer/LibreWXR, el que fem servir sempre a useRadarAnimation.ts:156).
// Extreta literalment de rainviewer.com/files/rainviewer_api_colors_table.csv
// (columna "NEXRAD Level III"). Per sota de 0 dBZ tot és transparent (a=0).
const NEXRAD_LEVEL3_PALETTE: ReadonlyArray<readonly [dbz: number, r: number, g: number, b: number, a: number]> = [
  [-32,0,0,0,0],[-31,0,0,0,0],[-30,0,0,0,0],[-29,0,0,0,0],[-28,0,0,0,0],[-27,0,0,0,0],[-26,0,0,0,0],[-25,0,0,0,0],
  [-24,0,0,0,0],[-23,0,0,0,0],[-22,0,0,0,0],[-21,0,0,0,0],[-20,0,0,0,0],[-19,0,0,0,0],[-18,0,0,0,0],[-17,0,0,0,0],
  [-16,0,0,0,0],[-15,0,0,0,0],[-14,0,0,0,0],[-13,0,0,0,0],[-12,0,0,0,0],[-11,0,0,0,0],[-10,0,0,0,0],[-9,0,0,0,0],
  [-8,0,0,0,0],[-7,0,0,0,0],[-6,0,0,0,0],[-5,0,0,0,0],[-4,0,0,0,0],[-3,0,0,0,0],[-2,0,0,0,0],[-1,0,0,0,0],
  [0,4,233,231,255],[1,3,234,231,255],[2,2,235,231,255],[3,1,236,231,255],[4,0,237,231,255],[5,0,239,231,255],
  [6,0,222,234,255],[7,0,205,237,255],[8,0,189,240,255],[9,0,172,243,255],[10,0,156,247,255],[11,0,124,247,255],
  [12,0,93,247,255],[13,0,62,247,255],[14,0,31,247,255],[15,0,0,247,255],[16,0,51,197,255],[17,0,102,148,255],
  [18,0,153,98,255],[19,0,204,49,255],[20,0,255,0,255],[21,0,240,0,255],[22,1,226,1,255],[23,1,211,1,255],
  [24,2,197,2,255],[25,3,183,3,255],[26,4,169,3,255],[27,5,155,3,255],[28,6,142,4,255],[29,7,128,4,255],
  [30,8,115,5,255],[31,57,143,4,255],[32,106,171,3,255],[33,156,199,2,255],[34,205,227,0,255],[35,255,255,0,255],
  [36,251,245,0,255],[37,247,235,0,255],[38,243,225,0,255],[39,239,215,0,255],[40,236,206,0,255],[41,239,194,0,255],
  [42,243,182,0,255],[43,246,170,0,255],[44,250,158,0,255],[45,254,147,0,255],[46,254,117,0,255],[47,254,88,0,255],
  [48,254,58,0,255],[49,254,29,0,255],[50,255,0,0,255],[51,241,0,0,255],[52,228,0,0,255],[53,215,0,0,255],
  [54,202,0,0,255],[55,189,0,0,255],[56,189,0,0,255],[57,189,0,0,255],[58,189,0,0,255],[59,189,0,0,255],
  [60,189,0,0,255],[61,202,0,50,255],[62,215,0,101,255],[63,228,0,152,255],[64,241,0,203,255],[65,254,0,254,255],
  [66,234,16,242,255],[67,214,32,231,255],[68,195,49,220,255],[69,175,65,209,255],[70,156,82,198,255],
  [71,175,116,209,255],[72,195,150,220,255],[73,214,185,231,255],[74,234,219,242,255],[75,254,254,254,255],
  [76,254,254,254,255],[77,254,254,254,255],[78,254,254,254,255],[79,254,254,254,255],[80,255,255,255,255],
  [81,255,255,255,255],[82,255,255,255,255],[83,255,255,255,255],[84,255,255,255,255],[85,255,255,255,255],
  [86,255,255,255,255],[87,255,255,255,255],[88,255,255,255,255],[89,255,255,255,255],[90,255,255,255,255],
  [91,255,255,255,255],[92,255,255,255,255],[93,255,255,255,255],[94,255,255,255,255],[95,255,255,255,255],
];

// Únicament entrades amb eco real (a>0) — per sota són totes idèntiques (transparents).
const OPAQUE_PALETTE = NEXRAD_LEVEL3_PALETTE.filter(([, , , , a]) => a > 0);

export interface TileCoord {
  z: number;
  x: number;
  y: number;
  /** Posició del punt (lat/lon) en píxels dins la tessel·la (0..tileSize). */
  px: number;
  py: number;
}

/**
 * Web Mercator estàndard: converteix lat/lon a coordenades de tessel·la
 * (x, y, z) i a la posició en píxels dins d'aquella tessel·la.
 */
export function lonLatToTile(lon: number, lat: number, zoom: number, tileSize = 512): TileCoord {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const xFloat = ((lon + 180) / 360) * n;
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const x = Math.floor(xFloat);
  const y = Math.floor(yFloat);
  const px = Math.floor((xFloat - x) * tileSize);
  const py = Math.floor((yFloat - y) * tileSize);

  return { z: zoom, x, y, px, py };
}

/**
 * Troba el dBZ més proper a un color RGBA donat, cercant la mínima distància
 * euclidiana en RGB dins la paleta NEXRAD Level III. Retorna `null` si el
 * píxel és (pràcticament) transparent: cap eco de radar en aquest punt.
 */
export function rgbaToClosestDbz(r: number, g: number, b: number, a: number): number | null {
  if (a < 10) return null;

  let bestDbz = OPAQUE_PALETTE[0][0];
  let bestDist = Infinity;
  for (const [dbz, pr, pg, pb] of OPAQUE_PALETTE) {
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      bestDbz = dbz;
    }
  }
  return bestDbz;
}

/**
 * Relació Marshall-Palmer estàndard (Z-R) per convertir reflectivitat (dBZ)
 * a una estimació de la intensitat de precipitació en mm/h. És una
 * aproximació generalista, no una mesura calibrada per cap radar concret.
 */
export function dbzToMmPerHour(dbz: number): number {
  if (dbz <= 0) return 0;
  const z = 10 ** (dbz / 10);
  return (z / 200) ** (1 / 1.6);
}

// Marge de seguretat: en proves en directe s'ha observat que l'`Image` d'una
// tessel·la pot no disparar mai `onload` ni `onerror` (penja la promesa
// indefinidament). Sense aquest límit, el hook que la crida es quedaria
// esperant per sempre en lloc de degradar-se a "sense dades".
const TILE_FETCH_TIMEOUT_MS = 10000;

/**
 * Descarrega una única tessel·la PNG i en llegeix el píxel (px, py). Els
 * hosts de radar (librewxr.net i rainviewer.com) envien
 * `Access-Control-Allow-Origin: *`, així que la lectura del canvas no queda
 * "tainted". Mai llença ni queda penjada indefinidament: qualsevol error
 * (xarxa, CORS, 404, timeout) retorna `null`.
 */
export function fetchTilePixel(tileUrl: string, px: number, py: number): Promise<[number, number, number, number] | null> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: [number, number, number, number] | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(value);
    };
    const timeoutId = setTimeout(() => settle(null), TILE_FETCH_TIMEOUT_MS);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => settle(null);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return settle(null);

        ctx.drawImage(img, -px, -py);
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
        settle([r, g, b, a]);
      } catch {
        settle(null);
      }
    };

    img.src = tileUrl;
  });
}
