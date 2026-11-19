// src/utils/detailCardLabel.ts
// Nom accessible de cada targeta de la graella de ginys (DetailWidgetsGrid, pestanyes Detall i Cel): el nom del giny, el
// seu valor principal i "· Detall", amb el mateix patró que els destacats de la pestanya Ara (HighlightsRow:
// "Pressió 1007 hPa · Detall"). Abans la targeta era un botó sense nom i el lector de pantalla en llegia tot el
// contingut barrejat ("VENT 239° SO N S O E VENT FLUIXET 6 KM/H…").
// Cada valor surt de la mateixa dada i amb el mateix format que el giny; la pressió, l'aire i la visibilitat, amb les
// mateixes plantilles que els destacats (tabs.teaser*), perquè diguin exactament el mateix.
// DOCTRINA RISC ZERO: sense dada, només el nom ("Vent · Detall"), mai un 0 inventat.
import { TRANSLATIONS, type Language } from '../translations';
import { getWindDirectionText } from '../components/widgets/widgetHelpers';
import { formatDecimal, formatTemp, type WeatherUnit } from './formatters';
import { AQI_TRANSLATIONS, extractAqiData, getAqiLevel } from './aqiLevel';
import { formatVisibilityKm, type VisibilityBound } from './visibilityDisplay';
import { effectiveCloudCoverNow } from './cloudCoverLevel';
import { getMoonPhaseName, getNamedMoonPhase } from './lunarPhases';
import { calculateSnowLevel } from './rules/winterRules';
import type { NextSunEvent } from './solar/nextSunEvent';

/** El valor de cada giny, el mateix que rep el giny (DetailWidgetsGrid els passa tots dos de la mateixa variable). */
export type DetailCardInput =
  /** °C: la d'ara del giny (buildTemperatureWindow), la mateixa que la capçalera. */
  | { id: 'temperature'; celsius: number | null; unit: WeatherUnit }
  | { id: 'wind'; kmh: number | null | undefined; degrees: number | null | undefined }
  | { id: 'uv'; index: number | null | undefined }
  | { id: 'visibility'; meters: number | null; bound: VisibilityBound }
  | { id: 'cloudLayers'; low: unknown; mid: unknown; high: unknown }
  | { id: 'pressure'; hpa: number | null | undefined }
  /** °C, sense convertir: el giny de rosada també el mostra així. */
  | { id: 'dewPoint'; celsius: number | null | undefined }
  | { id: 'cape'; jkg: number | null | undefined }
  /** aqiData.current, el mateix objecte que rep AqiWidget. */
  | { id: 'aqi'; current: unknown }
  /** L'instant de la targeta (ms): el nom de la fase és el del dia, com a MoonWidget. */
  | { id: 'moon'; nowMs: number }
  | { id: 'sun'; next: NextSunEvent | null }
  /** Nivell de congelació (m): la cota de neu en surt amb calculateSnowLevel, com al giny. */
  | { id: 'snowLevel'; freezingLevel: number | null | undefined; unit: WeatherUnit };

export type DetailCardId = DetailCardInput['id'];

// Els noms, els mateixos (o gairebé) que el títol visible de cada giny, perquè qui el diu en veu alta el trobi.
const NAMES: Record<Language, Record<DetailCardId, string>> = {
  ca: { temperature: 'Temperatura', wind: 'Vent', uv: 'Índex UV', visibility: 'Visibilitat', cloudLayers: 'Capes de núvols', pressure: 'Pressió', dewPoint: 'Punt de rosada', cape: 'CAPE', aqi: "Qualitat de l'aire", moon: 'Fase lunar', sun: 'Cicle solar', snowLevel: 'Cota de neu' },
  es: { temperature: 'Temperatura', wind: 'Viento', uv: 'Índice UV', visibility: 'Visibilidad', cloudLayers: 'Capas de nubes', pressure: 'Presión', dewPoint: 'Punto de rocío', cape: 'CAPE', aqi: 'Calidad del aire', moon: 'Fase lunar', sun: 'Ciclo solar', snowLevel: 'Cota de nieve' },
  en: { temperature: 'Temperature', wind: 'Wind', uv: 'UV index', visibility: 'Visibility', cloudLayers: 'Cloud layers', pressure: 'Pressure', dewPoint: 'Dew point', cape: 'CAPE', aqi: 'Air quality', moon: 'Moon phase', sun: 'Sun cycle', snowLevel: 'Snow level' },
  fr: { temperature: 'Température', wind: 'Vent', uv: 'Indice UV', visibility: 'Visibilité', cloudLayers: 'Couches nuageuses', pressure: 'Pression', dewPoint: 'Point de rosée', cape: 'CAPE', aqi: "Qualité de l'air", moon: 'Phase lunaire', sun: 'Cycle solaire', snowLevel: 'Limite neige' },
};

const SUN_EVENT: Record<Language, Record<NextSunEvent['kind'], string>> = {
  ca: { sunrise: 'sortida del sol a les {v}', sunset: 'posta de sol a les {v}' },
  es: { sunrise: 'salida del sol a las {v}', sunset: 'puesta de sol a las {v}' },
  en: { sunrise: 'sunrise at {v}', sunset: 'sunset at {v}' },
  fr: { sunrise: 'lever du soleil à {v}', sunset: 'coucher du soleil à {v}' },
};

const fill = (template: string, value: string) => template.replace('{v}', value);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Nom i valor ("Vent 6 km/h SO"), o null si el giny no té dada. */
const withValue = (input: DetailCardInput, lang: Language): string | null => {
  const name = NAMES[lang][input.id];
  const teasers = TRANSLATIONS[lang].tabs;
  switch (input.id) {
    case 'temperature': {
      const v = formatTemp(input.celsius, input.unit);
      return v === null ? null : `${name} ${v}°`;
    }
    case 'wind': {
      // CompassGauge: velocitat arrodonida i direcció en lletres (d'on ve el vent), sense la direcció si falta.
      if (!isNum(input.kmh)) return null;
      const dir = isNum(input.degrees) ? ` ${getWindDirectionText(input.degrees, lang)}` : '';
      return `${name} ${Math.round(input.kmh)} km/h${dir}`;
    }
    case 'uv':
      return isNum(input.index) ? `${name} ${formatDecimal(input.index, lang)}` : null;
    case 'visibility':
      return input.meters === null ? null : fill(teasers.teaserVisibility, formatVisibilityKm(Math.max(0, input.meters), input.bound, lang));
    case 'cloudLayers': {
      const effective = effectiveCloudCoverNow(input.low, input.mid, input.high);
      return effective === null ? null : `${name} ${Math.round(effective)}${lang === 'en' ? '%' : ' %'}`;
    }
    case 'pressure':
      // CircularGauge arrodoneix a l'enter (com els destacats).
      return isNum(input.hpa) ? fill(teasers.teaserPressure, String(Math.round(input.hpa))) : null;
    case 'dewPoint':
      return isNum(input.celsius) ? `${name} ${Math.round(input.celsius)}°` : null;
    case 'cape':
      return isNum(input.jkg) ? `${name} ${Math.round(input.jkg)} J/kg` : null;
    case 'aqi': {
      const aqi = extractAqiData(input.current);
      if (!aqi) return null;
      return fill(teasers.teaserAir, AQI_TRANSLATIONS[lang][getAqiLevel(aqi)].toLocaleLowerCase(lang));
    }
    case 'moon': {
      const phase = isNum(input.nowMs) ? getNamedMoonPhase(new Date(input.nowMs)) : NaN;
      return Number.isFinite(phase) ? `${name}, ${getMoonPhaseName(phase, lang)}` : null;
    }
    case 'sun':
      return input.next ? `${name}, ${fill(SUN_EVENT[lang][input.next.kind], input.next.time)}` : null;
    case 'snowLevel': {
      // SnowLevelWidget: en metres, o en peus si la unitat és °F.
      const snow = calculateSnowLevel(input.freezingLevel);
      if (snow === null) return null;
      return input.unit === 'F' ? `${name} ${Math.round(snow * 3.28084)} ft` : `${name} ${Math.round(snow)} m`;
    }
  }
};

/** "Vent 6 km/h SO · Detall"; sense dada, "Vent · Detall". */
export const buildDetailCardLabel = (input: DetailCardInput, lang: string): string => {
  const safeLang: Language = lang in NAMES ? (lang as Language) : 'ca';
  const main = withValue(input, safeLang) ?? NAMES[safeLang][input.id];
  return `${main} · ${TRANSLATIONS[safeLang].tabs.detail}`;
};
