// src/components/planet/planetFormat.ts
// Format dels valors d'«Extrems del planeta» (targeta i detall), amb espai fi abans de la unitat.
import type { Language } from '../../translations';
import { formatDecimal, getSafeLocale, getUnitLabel, type WeatherUnit } from '../../utils/formatters';
import type { GdacsAlert } from '../../services/planetExtremesApi';
import { countryName, type RecordKey } from '../../utils/planetExtremes';
import type { PlanetStrings } from './planetI18n';

const NBSP = ' ';

/** Temperatura en la unitat de l'app: "28,0 °C", "−24 °C", "97 °F". */
export const tempText = (celsius: number, unit: WeatherUnit, lang: Language, digits = 0): string => {
    const value = unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
    const shown = digits > 0 ? formatDecimal(value, lang, digits) : String(Math.round(value));
    return `${shown.replace('-', '−')}${NBSP}${getUnitLabel(unit)}`;
};

/** Una diferència de temperatura (els °F d'una diferència no porten el +32). */
export const tempDeltaText = (celsius: number, unit: WeatherUnit, lang?: Language, digits = 0): string => {
    const value = unit === 'F' ? celsius * 1.8 : celsius;
    const shown = digits > 0 && lang ? formatDecimal(value, lang, digits) : String(Math.round(value));
    return `${shown}${NBSP}${getUnitLabel(unit)}`;
};

export const kmhText = (kmh: number): string => `${Math.round(kmh)}${NBSP}km/h`;
export const hpaText = (hpa: number): string => `${Math.round(hpa)}${NBSP}hPa`;

/** El valor d'un rècord tal com es llegeix. La calor humida, sense decimal (vegeu el podi i l'empat tècnic). */
export function recordValueText(key: RecordKey, value: number, unit: WeatherUnit, lang: Language, digits = 0): string {
    switch (key) {
        case 'gust': return kmhText(value);
        case 'lowPressure': return hpaText(value);
        default: return tempText(value, unit, lang, digits);
    }
}

/** "Cicló tropical Murasu", "Volcà Merapi", "Inundacions · Turquia". */
export const alertTitle = (alert: GdacsAlert, s: PlanetStrings, lang: Language): string => {
    const kind = s.alertKinds[alert.type];
    if ((alert.type === 'TC' || alert.type === 'VO') && alert.name) return `${kind} ${alert.name}`;
    const country = countryName(alert.country, lang);
    return country ? `${kind} · ${country}` : kind;
};

/** "1 de nov." (la data UTC d'una dada). */
export const shortDate = (iso: string, lang: Language): string =>
    new Date(iso).toLocaleDateString(getSafeLocale(lang), { day: 'numeric', month: 'short', timeZone: 'UTC' });
