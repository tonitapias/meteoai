// src/utils/beaufort.ts
// L'escala de Beaufort del modal del vent, també per al giny de Detall: abans el giny tenia una escala "simplificada"
// pròpia i un vent de 13 km/h hi sortia "Moderat" mentre el modal deia "Vent fluix" (auditoria d'UX del 16/11/2026, B3).
import type { Language } from '../translations';

// Escala Beaufort oficial (OMM), km/h verificats contra Meteocat (Servei Meteorològic de
// Catalunya) — https://www.meteo.cat/wpweb/divulgacio/la-prediccio-meteorologica/escales-de-vent-i-mar/escala-beaufort/
// Noms per idioma verificats contra Meteocat (ca), Viquipèdia es/en/fr (es/en/fr).
export const BEAUFORT: { max: number; label: Record<Language, string> }[] = [
  { max: 2, label: { ca: 'Calma', es: 'Calma', en: 'Calm', fr: 'Calme' } },
  { max: 6, label: { ca: 'Ventolina', es: 'Ventolina', en: 'Light air', fr: 'Très légère brise' } },
  { max: 11, label: { ca: 'Vent fluixet', es: 'Flojito', en: 'Light breeze', fr: 'Légère brise' } },
  { max: 19, label: { ca: 'Vent fluix', es: 'Flojo', en: 'Gentle breeze', fr: 'Petite brise' } },
  { max: 29, label: { ca: 'Vent moderat', es: 'Bonancible', en: 'Moderate breeze', fr: 'Jolie brise' } },
  { max: 39, label: { ca: 'Vent fresquet', es: 'Fresquito', en: 'Fresh breeze', fr: 'Bonne brise' } },
  { max: 50, label: { ca: 'Vent fresc', es: 'Fresco', en: 'Strong breeze', fr: 'Vent frais' } },
  { max: 61, label: { ca: 'Vent fort', es: 'Frescachón', en: 'Near gale', fr: 'Grand frais' } },
  { max: 74, label: { ca: 'Temporal', es: 'Temporal', en: 'Gale', fr: 'Coup de vent' } },
  { max: 87, label: { ca: 'Temporal fort', es: 'Temporal fuerte', en: 'Strong gale', fr: 'Fort coup de vent' } },
  { max: 101, label: { ca: 'Temporal molt fort', es: 'Temporal duro', en: 'Storm', fr: 'Tempête' } },
  { max: 117, label: { ca: 'Temporal violent', es: 'Temporal muy duro', en: 'Violent storm', fr: 'Violente tempête' } },
  { max: Infinity, label: { ca: 'Huracà', es: 'Temporal huracanado', en: 'Hurricane', fr: "Vent d'ouragan" } },
];

export function getBeaufort(speedKmh: number, lang: Language): { force: number; label: string } {
  const force = BEAUFORT.findIndex(b => speedKmh <= b.max);
  const safeForce = force === -1 ? 12 : force;
  return { force: safeForce, label: BEAUFORT[safeForce].label[lang] };
}
