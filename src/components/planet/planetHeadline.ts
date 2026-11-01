// src/components/planet/planetHeadline.ts
// El xip de la Vista essencial: només els dies que hi ha un protagonista (planetProtagonist: calor humida de
// perill, un cicló de categoria 4 o 5, una alerta vermella de GDACS o un rècord físic excepcional), «Vols més
// detall?» ho diu el primer de tot, i tocar-lo n'obre la fitxa. Es carrega a part i tard (usePlanetHeadline), perquè
// les dades del planeta i els textos de la secció no pesin a la càrrega de la previsió.
import { getSafeLocale } from '../../utils/formatters';
import { basinOcean, countryName, placeInline, planetProtagonist, type CycloneSummary, type Protagonist } from '../../utils/planetExtremes';
import type { PlanetEntry, PlanetHeadlineIcon } from '../../utils/planetNav';
import { fetchPlanetExtremes } from '../../services/planetExtremesApi';
import type { Language } from '../../translations';
import { PLANET_STRINGS, fill } from './planetI18n';
import { hpaText, kmhText, tempText } from './planetFormat';

export type { PlanetHeadlineIcon };

export interface PlanetHeadline {
  /** El text del xip, amb majúscula inicial. */
  text: string;
  /** El mateix en minúscula, per a la línia curta ("Vista completa · tifó de categoria 4 al Pacífic…"). */
  compactText: string;
  /** La fitxa que obre el xip. */
  entry: PlanetEntry;
  icon: PlanetHeadlineIcon;
}

export type PlanetHeadlineResult =
  | { status: 'ready'; headline: PlanetHeadline | null }
  // El worker ha respost sense algun bloc (el refrescava): val la pena tornar-ho a provar.
  | { status: 'incomplete' };

const capitalized = (text: string, lang: Language) => text.charAt(0).toLocaleUpperCase(getSafeLocale(lang)) + text.slice(1);

export function planetHeadlineText(summary: CycloneSummary, lang: Language): Pick<PlanetHeadline, 'text' | 'compactText'> {
  const s = PLANET_STRINGS[lang] ?? PLANET_STRINGS.ca;
  const locale = getSafeLocale(lang);
  const compactText = fill(s.headline, {
    kind: s.kinds[summary.kind].toLocaleLowerCase(locale),
    n: summary.category,
    where: s.oceans[basinOcean(summary.basin)],
  });
  return { text: capitalized(compactText, lang), compactText };
}

const ALERT_ICONS: Record<'TC' | 'FL' | 'WF' | 'VO', PlanetHeadlineIcon> = { TC: 'cyclone', FL: 'flood', WF: 'fire', VO: 'volcano' };

export function protagonistHeadline(protagonist: Protagonist, lang: Language): PlanetHeadline {
  const s = PLANET_STRINGS[lang] ?? PLANET_STRINGS.ca;
  const locale = getSafeLocale(lang);
  switch (protagonist.kind) {
    case 'cyclone':
      return { ...planetHeadlineText(protagonist.summary, lang), entry: { kind: 'cyclone', id: protagonist.summary.cyclone.id }, icon: 'cyclone' };
    case 'wetBulb': {
      const compactText = fill(s.headlineWetBulb, { t: tempText(protagonist.station.value, 'C', lang), place: placeInline(protagonist.station, lang) });
      return { text: capitalized(compactText, lang), compactText, entry: { kind: 'record', record: 'wetBulb' }, icon: 'heat' };
    }
    case 'alert': {
      const { alert, cycloneId } = protagonist;
      const kind = s.alertKinds[alert.type].toLocaleLowerCase(locale);
      const country = countryName(alert.country, lang);
      const what = [alert.name ? `${kind} ${alert.name}` : kind, country].filter(Boolean).join(' · ');
      const compactText = fill(s.headlineAlert, { level: s.alertLevels[alert.level], what });
      return {
        text: capitalized(compactText, lang),
        compactText,
        entry: cycloneId ? { kind: 'cyclone', id: cycloneId } : { kind: 'list', tab: 'events' },
        icon: ALERT_ICONS[alert.type],
      };
    }
    default: {
      const { record, station } = protagonist;
      const v = record === 'gust' ? kmhText(station.value) : record === 'lowPressure' ? hpaText(station.value) : tempText(station.value, 'C', lang);
      const compactText = fill(s.headlineRecord[record], { v, place: placeInline(station, lang) });
      return {
        text: capitalized(compactText, lang),
        compactText,
        entry: { kind: 'record', record },
        icon: record === 'gust' ? 'wind' : record === 'lowPressure' ? 'pressure' : 'heat',
      };
    }
  }
}

export async function loadPlanetHeadline(lang: Language, nowMs: number = Date.now()): Promise<PlanetHeadlineResult> {
  const data = await fetchPlanetExtremes();
  if (!data.cyclones || !data.events || !data.metar) return { status: 'incomplete' };
  const protagonist = planetProtagonist(data, nowMs);
  return { status: 'ready', headline: protagonist ? protagonistHeadline(protagonist, lang) : null };
}
