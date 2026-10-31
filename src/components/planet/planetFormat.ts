// src/components/planet/planetFormat.ts
// Format dels valors d'«Extrems del planeta» (targeta i detall), amb espai fi abans de la unitat.
import type { Language } from '../../translations';
import { formatDecimal, getUnitLabel, type WeatherUnit } from '../../utils/formatters';

const NBSP = ' ';

/** Temperatura en la unitat de l'app: "28,0 °C", "−24 °C", "97 °F". */
export const tempText = (celsius: number, unit: WeatherUnit, lang: Language, digits = 0): string => {
    const value = unit === 'F' ? (celsius * 9) / 5 + 32 : celsius;
    const shown = digits > 0 ? formatDecimal(value, lang, digits) : String(Math.round(value));
    return `${shown.replace('-', '−')}${NBSP}${getUnitLabel(unit)}`;
};

/** Una diferència de temperatura (els °F d'una diferència no porten el +32). */
export const tempDeltaText = (celsius: number, unit: WeatherUnit): string =>
    `${Math.round(unit === 'F' ? celsius * 1.8 : celsius)}${NBSP}${getUnitLabel(unit)}`;

export const kmhText = (kmh: number): string => `${Math.round(kmh)}${NBSP}km/h`;
export const hpaText = (hpa: number): string => `${Math.round(hpa)}${NBSP}hPa`;
