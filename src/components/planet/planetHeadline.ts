// src/components/planet/planetHeadline.ts
// El xip de la Vista essencial: només els dies amb un cicló de categoria 4 o 5, «Vols més detall?» ho diu
// el primer de tot ("Tifó de categoria 4 al Pacífic"). Es carrega a part i tard (usePlanetHeadline), perquè
// les dades del planeta i els textos de la secció no pesin a la càrrega de la previsió.
import { getSafeLocale } from '../../utils/formatters';
import { basinOcean, bigCyclone, type CycloneSummary } from '../../utils/planetExtremes';
import { fetchPlanetExtremes } from '../../services/planetExtremesApi';
import type { Language } from '../../translations';
import { PLANET_STRINGS, fill } from './planetI18n';

export interface PlanetHeadline {
  /** El text del xip, amb majúscula inicial. */
  text: string;
  /** El mateix en minúscula, per a la línia curta ("Vista completa · tifó de categoria 4 al Pacífic…"). */
  compactText: string;
}

export type PlanetHeadlineResult =
  | { status: 'ready'; headline: PlanetHeadline | null }
  // El worker ha respost sense el bloc dels ciclons (el refrescava): val la pena tornar-ho a provar.
  | { status: 'incomplete' };

export function planetHeadlineText(summary: CycloneSummary, lang: Language): PlanetHeadline {
  const s = PLANET_STRINGS[lang] ?? PLANET_STRINGS.ca;
  const locale = getSafeLocale(lang);
  const compactText = fill(s.headline, {
    kind: s.kinds[summary.kind].toLocaleLowerCase(locale),
    n: summary.category,
    where: s.oceans[basinOcean(summary.basin)],
  });
  return { text: compactText.charAt(0).toLocaleUpperCase(locale) + compactText.slice(1), compactText };
}

export async function loadPlanetHeadline(lang: Language, nowMs: number = Date.now()): Promise<PlanetHeadlineResult> {
  const data = await fetchPlanetExtremes();
  if (!data.cyclones) return { status: 'incomplete' };
  const big = bigCyclone(data.cyclones.cyclones, nowMs);
  return { status: 'ready', headline: big ? planetHeadlineText(big, lang) : null };
}
