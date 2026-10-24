// src/components/StarfieldBackdrop.tsx
// Fons estelat del modal Lunar (direcció visual "planetari/astronòmic"); el Cicle solar en té un de propi.
// Estàtic i pensat per a mòbils modestos: les estrelles van en un SVG com a data-URI de
// background-image, que el navegador rasteritza una sola vegada. Abans eren 30-100 <circle> amb
// una animació d'opacitat infinita cadascun (no composable: repintava tot el full a cada frame)
// i un preserveAspectRatio="none" que les estirava en el·lipses.
import { useMemo, type CSSProperties } from 'react';

interface StarfieldBackdropProps {
  density?: number;   // estrelles en un full de mòbil (~390×800 px), per defecte 70, tope 100
  tint?: string;       // color dels punts, p.ex. '#818cf8' (Lluna)
  /** Estrelles brillants (més grosses i opaques) per full de mòbil; amb alguna, la resta queden més tènues. */
  bright?: number;
  className?: string;
  style?: CSSProperties;
}

// PRNG determinista (mulberry32) — mateixa disposició d'estrelles a cada render/muntatge.
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Àrea de referència: un full de mòbil, on `density` conserva el nombre d'estrelles d'abans.
const REFERENCE_AREA = 390 * 800;

// Dues capes de mosaic amb mides sense divisors comuns: la combinació no es repeteix de manera
// visible ni en un full d'escriptori (fins a ~1024 px d'amplada).
const TILES = [{ size: 397, seed: 20260906 }, { size: 541, seed: 20261007 }];

function buildTile(size: number, seed: number, stars: number, tint: string, bright = 0): string {
  const rand = mulberry32(seed);
  let circles = '';
  // Amb estrelles brillants, les altres es fan més petites i tènues perquè el cel tingui profunditat; sense, la
  // seqüència i les mides són les de sempre (el modal Lunar no canvia).
  for (let i = 0; i < stars + bright; i++) {
    const isBright = i >= stars;
    const r = isBright ? 1.5 + rand() * 0.7 : bright > 0 ? 0.45 + rand() * 0.9 : 0.5 + rand() * 1.3;
    // Dins del mosaic sencer: una estrella tallada a la vora no continuaria a la peça del costat.
    const cx = r + rand() * (size - 2 * r);
    const cy = r + rand() * (size - 2 * r);
    const opacity = isBright ? 0.9 + rand() * 0.1 : bright > 0 ? 0.2 + rand() * 0.45 : 0.25 + rand() * 0.6;
    circles += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(2)}" fill-opacity="${opacity.toFixed(2)}"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" fill="${tint}">${circles}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export const StarfieldBackdrop = ({ density = 70, tint = '#e2e8f0', bright = 0, className = '', style: extraStyle }: StarfieldBackdropProps) => {
  const tiles = useMemo(() => {
    const perLayer = Math.max(0, Math.min(100, density)) / TILES.length;
    const brightPerLayer = Math.max(0, bright) / TILES.length;
    const perTile = (n: number, size: number) => Math.round(n * (size * size) / REFERENCE_AREA);
    return {
      backgroundImage: TILES.map(({ size, seed }) => buildTile(size, seed, perTile(perLayer, size), tint, perTile(brightPerLayer, size))).join(', '),
      backgroundSize: TILES.map(({ size }) => `${size}px ${size}px`).join(', '),
    };
  }, [density, tint, bright]);

  return (
    <div className={`absolute inset-0 pointer-events-none select-none ${className}`} style={extraStyle ? { ...tiles, ...extraStyle } : tiles} aria-hidden="true" />
  );
};
