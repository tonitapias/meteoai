// src/utils/welcome/contourTexture.ts
// Corbes de nivell gravades al disc de la columna del cel de la benvinguda. És un relleu real (56 × 56 punts,
// Copernicus DEM GLO-90, 36 km) fet servir com a textura anònima: sense nom de lloc i sense cap consulta.
// Es calcula un sol cop (marching squares sobre la graella suavitzada) i es reutilitza a tots els muntatges.

// 1 byte = 8 m per sobre de 900 m (0 = 900 m o menys).
const DEM_B64 = 'mICFjpq0m3aejoZ+eWJ7Y2FgX15fZWhraWVbWlhRT0tSZXN7iKjNuZCZprO/2uvNuLammJSTqb+cmJusoLuZd6a1mIt3coN4eW5oZnFtaWhnY2FgV0tRUFx1ipWdlrDbt5rWztLZ2OfHqLjCsHyu0cKosrOurpWCub+pgnySmZWJenVueHBqYV5fX2NVTVVcXG2Al7a7qrXbrrPh68nD18jN1L+IZpbDx7jBtqupo6GruJSGp6qum4h7eHxybWFfYF9iY1VTV19teo2kweC51crJyuPOu7u+y9Svj2tekaOp0cq6tcKppainkZm0saOMioGAcWlhaGdtZ2VbV1ZdZW6BmKGv19TW1drM2Lupo7OwvLueXlh/i5C/0sa+07uvpZmZqK2gmZaIgHFnbHR4c2pnWlpTV1tlbIWaucfFs7aqvMDj07mYl6yjnW1TQGp2hJ/a0erVv7ClnZacnqGZjnhraHSCgX1zbmleVk9YVmBjdpWZmZKWpMLAy+fHrJaEioOTgFMqS2CetbLSyL2yqqWbjIuLlop/gH5+jZGCd3RtX1pTTFJTV1plbH6ap8G6zc7W58iloq+giWpXRDYuQYfGxcvMwquakZqSi4uYjI6IgYuXkIR7dWxhUk9ITFRbXWqEoJ+jnZC0nrvPx8K4zK2tmohzOSMphKrUyr+yn5evppyZj42IiYSWopCOg3l2aV9VS0hQVFRXam55d4GFfI+FncPj38LfzquKknZUORiDr9GunpyfrbeqrJ+blI6KgJSajYh/e2dfV1FGR0lNVFFcYFtZYmJzeIWqtM3b1N3IsbObcVk6KZCosreuwLrRt62mn5+enJx/jpmShIBvbVRQTT1LTURIRERUanJ5h5GRn6zD5dfu8tPEvJp3SjNJl7m9u7XK2uK1saGfnJqZlXyUlYyGg2phU0w4WEhGO0E4PlZ5i5qdp6y0xM7TttraxL2Zp4NeOmGhzr27yNDl5La9q6ifk5SQd5CSkYx3Y11TS0VRRjw3MztNVmp3dIuhiqenrbSmzr+nsZGJd1hafbS8pqy5xdHkwdy5r56Zj4JzkpWVkG9aVldPNkM/OzA3P0RIWlpjbHWCiIOHnKzQwraNj31xbn1sv6ijo7XEzd/XzsCtp6Gbj2iAlYZ5ZFVTR0k4ODIyMTU4PD5CV19sc3mLmqi6wNm4raqqlop7YlfHuKij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';
const N = 56;
const E0 = 900;
/** Graella on es tracen les corbes (més fina que la del relleu: corbes més suaus). */
const M = 64;

/** Disc on es gravaven, en coordenades del viewBox de 640 × 640 de la columna. */
export const DISC = { cx: 320, cy: 500, rx: 230, ry: 70 } as const;

const NORMAL_LEVELS = [1100, 1300, 1700, 1900, 2100, 2500, 2700];
const INDEX_LEVELS = [1500, 2300];

// Segments per cas de marching squares: t/r/b/l = vores de dalt, dreta, baix i esquerra de la cel·la.
// Bits: dalt-esquerra 8, dalt-dreta 4, baix-dreta 2, baix-esquerra 1.
const SEGMENTS: Readonly<Record<number, readonly string[]>> = {
  1: ['lb'], 2: ['br'], 3: ['lr'], 4: ['tr'], 5: ['tr', 'lb'], 6: ['tb'], 7: ['tl'],
  8: ['tl'], 9: ['tb'], 10: ['tl', 'br'], 11: ['tr'], 12: ['lr'], 13: ['br'], 14: ['lb'],
};

function decode(): Float32Array {
  const raw = atob(DEM_B64);
  const z = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) z[k] = E0 + raw.charCodeAt(k) * 8;
  return z;
}

const catmullRom = (p0: number, p1: number, p2: number, p3: number, t: number): number =>
  p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));

function resample(z: Float32Array): Float32Array {
  const at = (i: number, j: number) => z[Math.min(N - 1, Math.max(0, i)) * N + Math.min(N - 1, Math.max(0, j))];
  const g = new Float32Array(M * M);
  for (let r = 0; r < M; r++) {
    for (let c = 0; c < M; c++) {
      const gx = (c / (M - 1)) * (N - 1), gy = (r / (M - 1)) * (N - 1);
      const j = Math.floor(gx), i = Math.floor(gy), tx = gx - j, ty = gy - i;
      const rows = [-1, 0, 1, 2].map(m => catmullRom(at(i + m, j - 1), at(i + m, j), at(i + m, j + 1), at(i + m, j + 2), tx));
      g[r * M + c] = catmullRom(rows[0], rows[1], rows[2], rows[3], ty);
    }
  }
  return g;
}

/** Punt de la graella (columna, fila) → coordenades del viewBox, dins del disc en perspectiva. */
const toView = (gx: number, gy: number): string => {
  const u = -1 + (2 * gx) / (M - 1), v = 1 - (2 * gy) / (M - 1);
  return `${(DISC.cx + u * 0.96 * DISC.rx).toFixed(1)} ${(DISC.cy - v * 0.96 * DISC.ry).toFixed(1)}`;
};

function contour(g: Float32Array, level: number): string {
  let d = '';
  for (let i = 0; i < M - 1; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = g[i * M + j], b = g[i * M + j + 1], c = g[(i + 1) * M + j + 1], e = g[(i + 1) * M + j];
      const code = (a >= level ? 8 : 0) | (b >= level ? 4 : 0) | (c >= level ? 2 : 0) | (e >= level ? 1 : 0);
      const segs = SEGMENTS[code];
      if (!segs) continue;
      const edge: Record<string, [number, number]> = {};
      if ((a >= level) !== (b >= level)) edge.t = [j + (level - a) / (b - a), i];
      if ((b >= level) !== (c >= level)) edge.r = [j + 1, i + (level - b) / (c - b)];
      if ((e >= level) !== (c >= level)) edge.b = [j + (level - e) / (c - e), i + 1];
      if ((a >= level) !== (e >= level)) edge.l = [j, i + (level - a) / (e - a)];
      for (const s of segs) {
        const p = edge[s[0]], q = edge[s[1]];
        if (!p || !q) continue;
        // Només dins del disc (amb marge): el relleu és quadrat i el disc, rodó.
        const mu = -1 + (p[0] + q[0]) / (M - 1), mv = 1 - (p[1] + q[1]) / (M - 1);
        if (mu * mu + mv * mv > 0.94) continue;
        d += `M${toView(p[0], p[1])}L${toView(q[0], q[1])}`;
      }
    }
  }
  return d;
}

let cached: { normal: string; index: string } | null = null;

/** Camins SVG de les corbes normals (cada 200 m) i de les mestres (1.500 i 2.300 m), calculats un sol cop. */
export function contourPaths(): { normal: string; index: string } {
  if (!cached) {
    const g = resample(decode());
    cached = {
      normal: NORMAL_LEVELS.map(l => contour(g, l)).join(''),
      index: INDEX_LEVELS.map(l => contour(g, l)).join(''),
    };
  }
  return cached;
}
