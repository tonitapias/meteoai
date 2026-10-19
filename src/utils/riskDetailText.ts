// src/utils/riskDetailText.ts
import type { RiskDetail, RiskDetailEvent } from '../services/geminiService';
import type { Language } from '../translations';
import { getSafeLocale } from './formatters';

/** Perills amb xifra (pic de la finestra + llindar); la resta són fenòmens de codi o l'avís d'aerosols. */
type MeasuredHazard = 'WIND' | 'RAIN' | 'HEAT' | 'COLD';

interface RiskDetailTexts {
    /** "cap a les 17:00": l'hora del pic o del fenomen. */
    at: (hour: string) => string;
    /** "a partir de les 05:00": per a la boira, que s'instal·la i es queda. */
    from: (hour: string) => string;
    /** {value} {when} {limit} */
    measured: Record<MeasuredHazard, string>;
    /** {t} = el llindar del tallafocs per a aquest nivell. */
    limits: Record<MeasuredHazard, { AMBER: string; RED: string }>;
    /** {at} o {from}; els aerosols són d'ara mateix i no porten hora; els llamps porten {value} (km). */
    events: Record<RiskDetailEvent, string>;
}

// Català i castellà: "la 01:00" però "les/las 17:00".
const RISK_DETAIL_TEXTS: Record<Language, RiskDetailTexts> = {
    ca: {
        at: (h) => `cap a ${h.startsWith('01:') ? 'la' : 'les'} ${h}`,
        from: (h) => `a partir de ${h.startsWith('01:') ? 'la' : 'les'} ${h}`,
        measured: {
            WIND: 'Ràfegues de fins a {value} km/h {when} ({limit})',
            RAIN: 'Pluja de fins a {value} mm en una hora {when} ({limit})',
            HEAT: 'Màxima de {value} °C {when} ({limit})',
            COLD: 'Mínima de {value} °C {when} ({limit})'
        },
        limits: {
            WIND: { AMBER: 'precaució a partir de {t} km/h', RED: 'alerta a partir de {t} km/h' },
            RAIN: { AMBER: 'precaució a partir de {t} mm/h', RED: 'alerta per sobre de {t} mm/h' },
            HEAT: { AMBER: 'precaució a partir de {t} °C', RED: 'alerta a partir de {t} °C' },
            COLD: { AMBER: 'a {t} °C o menys pot glaçar', RED: 'fred extrem a {t} °C o menys' }
        },
        events: {
            storm: 'Tempesta prevista {at}',
            storm_hail: 'Tempesta amb calamarsa prevista {at}',
            snow: 'Neu prevista {at}',
            sleet: 'Aiguaneu prevista {at}',
            freezing: 'Pluja gelant prevista {at}',
            rime: 'Boira gebradora prevista {from}',
            fog: 'Boira prevista {from}',
            dust: 'Pols en suspensió (calima) ara mateix',
            particles: 'Partícules en suspensió ara mateix',
            lightning: 'Llamps detectats per satèl·lit a uns {value} km (últims 30 min)'
        }
    },
    es: {
        at: (h) => `hacia ${h.startsWith('01:') ? 'la' : 'las'} ${h}`,
        from: (h) => `a partir de ${h.startsWith('01:') ? 'la' : 'las'} ${h}`,
        measured: {
            WIND: 'Rachas de hasta {value} km/h {when} ({limit})',
            RAIN: 'Lluvia de hasta {value} mm en una hora {when} ({limit})',
            HEAT: 'Máxima de {value} °C {when} ({limit})',
            COLD: 'Mínima de {value} °C {when} ({limit})'
        },
        limits: {
            WIND: { AMBER: 'precaución a partir de {t} km/h', RED: 'alerta a partir de {t} km/h' },
            RAIN: { AMBER: 'precaución a partir de {t} mm/h', RED: 'alerta por encima de {t} mm/h' },
            HEAT: { AMBER: 'precaución a partir de {t} °C', RED: 'alerta a partir de {t} °C' },
            COLD: { AMBER: 'a {t} °C o menos puede helar', RED: 'frío extremo a {t} °C o menos' }
        },
        events: {
            storm: 'Tormenta prevista {at}',
            storm_hail: 'Tormenta con granizo prevista {at}',
            snow: 'Nieve prevista {at}',
            sleet: 'Aguanieve prevista {at}',
            freezing: 'Lluvia engelante prevista {at}',
            rime: 'Niebla engelante prevista {from}',
            fog: 'Niebla prevista {from}',
            dust: 'Polvo en suspensión (calima) ahora mismo',
            particles: 'Partículas en suspensión ahora mismo',
            lightning: 'Rayos detectados por satélite a unos {value} km (últimos 30 min)'
        }
    },
    fr: {
        at: (h) => `vers ${h}`,
        from: (h) => `à partir de ${h}`,
        measured: {
            WIND: "Rafales jusqu'à {value} km/h {when} ({limit})",
            RAIN: "Pluie jusqu'à {value} mm en une heure {when} ({limit})",
            HEAT: 'Maximale de {value} °C {when} ({limit})',
            COLD: 'Minimale de {value} °C {when} ({limit})'
        },
        limits: {
            WIND: { AMBER: 'vigilance à partir de {t} km/h', RED: 'alerte à partir de {t} km/h' },
            RAIN: { AMBER: 'vigilance à partir de {t} mm/h', RED: 'alerte au-delà de {t} mm/h' },
            HEAT: { AMBER: 'vigilance à partir de {t} °C', RED: 'alerte à partir de {t} °C' },
            COLD: { AMBER: 'risque de gel à {t} °C ou moins', RED: 'froid extrême à {t} °C ou moins' }
        },
        events: {
            storm: 'Orage prévu {at}',
            storm_hail: 'Orage avec grêle prévu {at}',
            snow: 'Neige prévue {at}',
            sleet: 'Pluie et neige mêlées prévues {at}',
            freezing: 'Pluie verglaçante prévue {at}',
            rime: 'Brouillard givrant prévu {from}',
            fog: 'Brouillard prévu {from}',
            dust: 'Poussière en suspension en ce moment',
            particles: 'Particules en suspension en ce moment',
            lightning: 'Éclairs détectés par satellite à environ {value} km (30 dernières min)'
        }
    },
    en: {
        at: (h) => `around ${h}`,
        from: (h) => `from ${h}`,
        measured: {
            WIND: 'Gusts up to {value} km/h {when} ({limit})',
            RAIN: 'Rain up to {value} mm in one hour {when} ({limit})',
            HEAT: 'High of {value} °C {when} ({limit})',
            COLD: 'Low of {value} °C {when} ({limit})'
        },
        limits: {
            WIND: { AMBER: 'caution from {t} km/h', RED: 'alert from {t} km/h' },
            RAIN: { AMBER: 'caution from {t} mm/h', RED: 'alert above {t} mm/h' },
            HEAT: { AMBER: 'caution from {t} °C', RED: 'alert from {t} °C' },
            COLD: { AMBER: 'ice possible at {t} °C or below', RED: 'extreme cold at {t} °C or below' }
        },
        events: {
            storm: 'Thunderstorm expected {at}',
            storm_hail: 'Thunderstorm with hail expected {at}',
            snow: 'Snow expected {at}',
            sleet: 'Sleet expected {at}',
            freezing: 'Freezing rain expected {at}',
            rime: 'Freezing fog expected {from}',
            fog: 'Fog expected {from}',
            dust: 'Airborne dust right now',
            particles: 'Airborne particles right now',
            lightning: 'Lightning detected by satellite about {value} km away (last 30 min)'
        }
    }
};

const MEASURED: readonly string[] = ['WIND', 'RAIN', 'HEAT', 'COLD'];

const fill = (template: string, values: Record<string, string>): string =>
    template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);

/**
 * La línia de detall del bàner "Motiu" (p. ex. "Ràfegues de fins a 62 km/h cap a les 17:00 (precaució a partir de
 * 50 km/h)"). Null si falta alguna dada: és millor no dir res que dir-ho a mitges.
 */
export const formatRiskDetail = (detail: RiskDetail, lang: Language): string | null => {
    const texts = RISK_DETAIL_TEXTS[lang] ?? RISK_DETAIL_TEXTS.ca;
    const locale = getSafeLocale(lang);
    const fmt = (v: number, digits: number): string => {
        const factor = 10 ** digits;
        const rounded = Math.round(v * factor) / factor;
        // Sense "-0" quan una mínima de -0,3 °C s'arrodoneix a 0.
        return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(rounded === 0 ? 0 : rounded);
    };

    if (detail.event) {
        const template = texts.events[detail.event];
        if (!template) return null;
        const needsHour = template.includes('{at}') || template.includes('{from}');
        if (needsHour && !detail.hour) return null;
        // Els llamps observats porten la distància (km enters) en lloc de l'hora.
        if (template.includes('{value}') && detail.value === null) return null;
        return fill(template, {
            ...(detail.hour ? { at: texts.at(detail.hour), from: texts.from(detail.hour) } : {}),
            ...(detail.value !== null ? { value: fmt(detail.value, 0) } : {})
        });
    }

    if (!MEASURED.includes(detail.hazard) || detail.level === 'GREEN') return null;
    if (detail.value === null || detail.threshold === null || !detail.hour) return null;
    const hazard = detail.hazard as MeasuredHazard;
    const limit = fill(texts.limits[hazard][detail.level], { t: fmt(detail.threshold, 0) });
    // La pluja amb un decimal (8,4 mm); vent i temperatura enters, com a la resta de l'app.
    return fill(texts.measured[hazard], {
        value: fmt(detail.value, hazard === 'RAIN' ? 1 : 0),
        when: texts.at(detail.hour),
        limit
    });
};
