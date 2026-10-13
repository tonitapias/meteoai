// src/utils/hazardTips.ts
import type { TacticalHazardType, TacticalRiskLevel, TacticalTip, TacticalTipCategory } from '../services/geminiService';
import type { Language } from '../translations';

type TipHazard = Exclude<TacticalHazardType, 'NONE'>;

/** Mateixes categories que demana el prompt del worker: vent, calor/fred, perills (tempesta, neu, boira, aire) i la resta. */
const TIP_CATEGORY: Record<TipHazard, TacticalTipCategory> = {
    WIND: 'WIND',
    HEAT: 'THERMAL',
    COLD: 'THERMAL',
    THERMAL: 'THERMAL',
    CONVECTIVE: 'HAZARD',
    SNOW_ICE: 'HAZARD',
    VISIBILITY: 'HAZARD',
    AIR_QUALITY: 'HAZARD',
    RAIN: 'SKY'
};

// Format "Causa: Efecte pràctic" i com a molt 15 paraules, com els consells de la IA.
const TIP_TEXTS: Record<Language, Record<TipHazard, string>> = {
    ca: {
        WIND: 'Ràfegues fortes: Assegureu objectes solts i eviteu zones arbrades',
        RAIN: 'Pluja intensa: Eviteu passos inundables i conduïu amb precaució',
        HEAT: "Calor intensa: Hidrateu-vos i eviteu l'esforç a les hores centrals",
        COLD: 'Risc de gel: Precaució en els desplaçaments i abrigueu-vos bé',
        THERMAL: "Temperatures extremes: Protegiu-vos i limiteu l'esforç a l'exterior",
        CONVECTIVE: 'Tempesta: Busqueu refugi en un edifici i eviteu zones exposades',
        SNOW_ICE: 'Neu o gel: Precaució en els desplaçaments, terra relliscós',
        VISIBILITY: 'Boira: Modereu la velocitat i encengueu els llums',
        AIR_QUALITY: "Aire de mala qualitat: Persones sensibles, limiteu l'esforç intens a l'exterior"
    },
    es: {
        WIND: 'Rachas fuertes: Asegurar objetos sueltos y evitar zonas arboladas',
        RAIN: 'Lluvia intensa: Evitar pasos inundables y conducir con precaución',
        HEAT: 'Calor intenso: Hidratarse y evitar el esfuerzo en las horas centrales',
        COLD: 'Riesgo de hielo: Precaución en los desplazamientos y abrigarse bien',
        THERMAL: 'Temperaturas extremas: Protegerse y limitar el esfuerzo al aire libre',
        CONVECTIVE: 'Tormenta: Buscar refugio en un edificio y evitar zonas expuestas',
        SNOW_ICE: 'Nieve o hielo: Precaución en los desplazamientos, suelo resbaladizo',
        VISIBILITY: 'Niebla: Moderar la velocidad y encender las luces',
        AIR_QUALITY: 'Aire de mala calidad: Personas sensibles, limitar el esfuerzo intenso al aire libre'
    },
    fr: {
        WIND: 'Fortes rafales : Fixez les objets légers et évitez les zones boisées',
        RAIN: 'Pluie intense : Évitez les passages inondables et roulez prudemment',
        HEAT: "Forte chaleur : Hydratez-vous et évitez l'effort aux heures chaudes",
        COLD: 'Risque de verglas : Prudence lors des déplacements, couvrez-vous bien',
        THERMAL: "Températures extrêmes : Protégez-vous et limitez l'effort en extérieur",
        CONVECTIVE: 'Orage : Abritez-vous dans un bâtiment et évitez les zones exposées',
        SNOW_ICE: 'Neige ou verglas : Prudence lors des déplacements, sol glissant',
        VISIBILITY: 'Brouillard : Réduisez la vitesse et allumez vos feux',
        AIR_QUALITY: "Air de mauvaise qualité : Personnes sensibles, limitez l'effort intense en extérieur"
    },
    en: {
        WIND: 'Strong gusts: Secure loose objects and avoid wooded areas',
        RAIN: 'Heavy rain: Avoid flood-prone underpasses and drive carefully',
        HEAT: 'Intense heat: Stay hydrated and avoid exertion in the middle of the day',
        COLD: 'Ice risk: Take care when travelling and dress warmly',
        THERMAL: 'Extreme temperatures: Protect yourself and limit outdoor exertion',
        CONVECTIVE: 'Thunderstorm: Shelter in a building and avoid exposed areas',
        SNOW_ICE: 'Snow or ice: Take care when travelling, slippery ground',
        VISIBILITY: 'Fog: Slow down and turn on your lights',
        AIR_QUALITY: 'Poor air quality: Sensitive groups, limit intense outdoor exertion'
    }
};

/**
 * Un consell fix per al perill del bàner quan l'avís (AMBER/RED) arriba sense cap consell. Passa quan el tallafocs puja
 * un GREEN de la IA (que, per la "regla de ferro" del prompt, porta els consells buits) o quan la IA no en dona cap.
 * Sense avís o sense perill, cap consell: la regla de ferro continua valent per al GREEN.
 */
export const getHazardFallbackTips = (
    level: TacticalRiskLevel | undefined,
    hazard: TacticalHazardType | undefined,
    lang: Language
): TacticalTip[] => {
    if ((level !== 'AMBER' && level !== 'RED') || !hazard || hazard === 'NONE') return [];
    const text = (TIP_TEXTS[lang] ?? TIP_TEXTS.ca)[hazard];
    return text ? [{ category: TIP_CATEGORY[hazard], text }] : [];
};
