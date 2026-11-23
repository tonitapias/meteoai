// src/components/RadarRealityBanner.tsx
//
// El radar veu pluja al lloc i la previsió, per a aquest moment, no. Dos casos (utils/radarReality.ts):
// - la previsió porta pluja en les properes hores: "La pluja s'ha avançat", amb l'hora que l'esperava;
// - no en porta: "Pluja no prevista" i, si es veu clar, si és un ruixat aïllat o una zona àmplia.
// Abans deia sempre "el model no preveu" i "pot ser un xàfec molt localitzat": el 18-11-2026 a Sant Feliu Sasserra
// la previsió esperava la pluja a la 01:00 i el radar la veia en tot el voltant.
// Blau, com l'altre avís del radar (RadarNowcastBanner): és informació, no un perill.
import { CloudRain, CloudSnow } from 'lucide-react';
import { useRadarRealityCheck } from '../hooks/useRadarRealityCheck';
import { firstForecastRainHour, radarRainIntensity, rainExtent, type RadarRainIntensity, type RainExtent } from '../utils/radarReality';
import { Language } from '../translations';
import type { NowcastKind } from '../utils/nowcastKind';

interface RadarRealityBannerProps {
    lat?: number;
    lon?: number;
    modelMmPerHourNow: number;
    /** La sèrie horària a partir de l'hora actual (chartData24h). */
    forecastHours?: ReadonlyArray<{ time: string; precip: number | null }>;
    lang: Language;
    /** Què cau (utils/nowcastKind.ts): pluja, neu o qualsevol de les dues. Sense, pluja. */
    kind?: NowcastKind;
}

interface LocalUIText {
    earlyTitle: string;
    /** {intensity} {until} */
    earlyDesc: string;
    /** "fins cap a la 01:00": l'hora en què la previsió esperava la pluja. */
    until: (hour: string) => string;
    unforecastTitle: string;
    /** {intensity} */
    unforecastDesc: string;
    intensity: Record<RadarRainIntensity, string>;
    extent: Record<RainExtent, string>;
}

// Diccionari propi (mateix patró que OfficialAlertBanner): textos curts i estables, no cal passar-los per
// translations/*.ts per a un banner petit. Català i castellà: "la 01:00" però "les/las 17:00" (com riskDetailText).
const LOCAL_UI_TEXTS: Record<Language, LocalUIText> = {
    ca: {
        earlyTitle: "La pluja s'ha avançat",
        earlyDesc: "Segons el radar, aquí ja plou {intensity}. La previsió no l'esperava {until}.",
        until: (h) => `fins cap a ${h.startsWith('01:') ? 'la' : 'les'} ${h}`,
        unforecastTitle: 'Pluja no prevista',
        unforecastDesc: "Segons el radar, aquí plou {intensity}, però la previsió no n'esperava en les properes hores.",
        intensity: { light: 'de manera feble', moderate: 'de manera moderada', heavy: 'amb força' },
        extent: {
            local: ' Sembla un ruixat local i podria durar poc.',
            wide: ' La pluja cobreix una zona àmplia al voltant.'
        }
    },
    es: {
        earlyTitle: 'La lluvia se ha adelantado',
        earlyDesc: 'Según el radar, aquí ya llueve {intensity}. La previsión no la esperaba {until}.',
        until: (h) => `hasta cerca de ${h.startsWith('01:') ? 'la' : 'las'} ${h}`,
        unforecastTitle: 'Lluvia no prevista',
        unforecastDesc: 'Según el radar, aquí llueve {intensity}, aunque la previsión no esperaba lluvia en las próximas horas.',
        intensity: { light: 'de forma débil', moderate: 'de forma moderada', heavy: 'con fuerza' },
        extent: {
            local: ' Parece un chubasco local y podría durar poco.',
            wide: ' La lluvia cubre una zona amplia alrededor.'
        }
    },
    en: {
        earlyTitle: 'The rain has come early',
        earlyDesc: "According to radar, {intensity} rain is already falling here. The forecast didn't expect it {until}.",
        until: (h) => `until around ${h}`,
        unforecastTitle: 'Rain not in the forecast',
        unforecastDesc: 'According to radar, {intensity} rain is falling here, but the forecast expected none in the next few hours.',
        intensity: { light: 'light', moderate: 'moderate', heavy: 'heavy' },
        extent: {
            local: ' It looks like a local shower and may not last long.',
            wide: ' The rain covers a wide area around.'
        }
    },
    fr: {
        earlyTitle: 'La pluie est en avance',
        earlyDesc: "Selon le radar, il pleut déjà {intensity} ici. La prévision ne l'attendait {until}.",
        until: (h) => `que vers ${h}`,
        unforecastTitle: 'Pluie non prévue',
        unforecastDesc: "Selon le radar, il pleut {intensity} ici, mais la prévision n'en attendait pas dans les prochaines heures.",
        intensity: { light: 'faiblement', moderate: 'modérément', heavy: 'fortement' },
        extent: {
            local: ' Cela ressemble à une averse locale, qui pourrait être brève.',
            wide: ' La pluie couvre une large zone alentour.'
        }
    }
};

type KindText = Pick<LocalUIText, 'earlyTitle' | 'earlyDesc' | 'unforecastTitle' | 'unforecastDesc' | 'extent'>;

// El radar no distingeix la pluja de la neu (utils/nowcastKind.ts ho decideix amb el cel previst i la temperatura). Les
// frases de pluja són les de dalt; aquestes, per a la neu i per a quan pot ser qualsevol de les dues.
const KIND_TEXTS: Record<Exclude<NowcastKind, 'rain'>, Record<Language, KindText>> = {
    snow: {
        ca: {
            earlyTitle: "La neu s'ha avançat",
            earlyDesc: "Segons el radar, aquí ja neva {intensity}. La previsió no l'esperava {until}.",
            unforecastTitle: 'Neu no prevista',
            unforecastDesc: "Segons el radar, aquí neva {intensity}, però la previsió no n'esperava en les properes hores.",
            extent: {
                local: ' Sembla un ruixat de neu local i podria durar poc.',
                wide: ' La neu cobreix una zona àmplia al voltant.'
            }
        },
        es: {
            earlyTitle: 'La nieve se ha adelantado',
            earlyDesc: 'Según el radar, aquí ya nieva {intensity}. La previsión no la esperaba {until}.',
            unforecastTitle: 'Nieve no prevista',
            unforecastDesc: 'Según el radar, aquí nieva {intensity}, aunque la previsión no esperaba nieve en las próximas horas.',
            extent: {
                local: ' Parece un chubasco de nieve local y podría durar poco.',
                wide: ' La nieve cubre una zona amplia alrededor.'
            }
        },
        en: {
            earlyTitle: 'The snow has come early',
            earlyDesc: "According to radar, {intensity} snow is already falling here. The forecast didn't expect it {until}.",
            unforecastTitle: 'Snow not in the forecast',
            unforecastDesc: 'According to radar, {intensity} snow is falling here, but the forecast expected none in the next few hours.',
            extent: {
                local: ' It looks like a local snow shower and may not last long.',
                wide: ' The snow covers a wide area around.'
            }
        },
        fr: {
            earlyTitle: 'La neige est en avance',
            earlyDesc: "Selon le radar, il neige déjà {intensity} ici. La prévision ne l'attendait {until}.",
            unforecastTitle: 'Neige non prévue',
            unforecastDesc: "Selon le radar, il neige {intensity} ici, mais la prévision n'en attendait pas dans les prochaines heures.",
            extent: {
                local: ' Cela ressemble à une averse de neige locale, qui pourrait être brève.',
                wide: ' La neige couvre une large zone alentour.'
            }
        }
    },
    mixed: {
        ca: {
            earlyTitle: "La pluja o la neu s'han avançat",
            earlyDesc: 'Segons el radar, aquí ja plou o neva {intensity}. La previsió no ho esperava {until}.',
            unforecastTitle: 'Pluja o neu no previstes',
            unforecastDesc: "Segons el radar, aquí plou o neva {intensity}, però la previsió no n'esperava en les properes hores.",
            extent: {
                local: ' Sembla un ruixat local i podria durar poc.',
                wide: ' La precipitació cobreix una zona àmplia al voltant.'
            }
        },
        es: {
            earlyTitle: 'La lluvia o la nieve se han adelantado',
            earlyDesc: 'Según el radar, aquí ya llueve o nieva {intensity}. La previsión no lo esperaba {until}.',
            unforecastTitle: 'Lluvia o nieve no previstas',
            unforecastDesc: 'Según el radar, aquí llueve o nieva {intensity}, aunque la previsión no esperaba precipitación en las próximas horas.',
            extent: {
                local: ' Parece un chubasco local y podría durar poco.',
                wide: ' La precipitación cubre una zona amplia alrededor.'
            }
        },
        en: {
            earlyTitle: 'Rain or snow has come early',
            earlyDesc: "According to radar, {intensity} rain or snow is already falling here. The forecast didn't expect it {until}.",
            unforecastTitle: 'Rain or snow not in the forecast',
            unforecastDesc: 'According to radar, {intensity} rain or snow is falling here, but the forecast expected none in the next few hours.',
            extent: {
                local: ' It looks like a local shower and may not last long.',
                wide: ' It covers a wide area around.'
            }
        },
        fr: {
            earlyTitle: 'La pluie ou la neige est en avance',
            earlyDesc: "Selon le radar, il pleut ou il neige déjà {intensity} ici. La prévision ne l'attendait {until}.",
            unforecastTitle: 'Pluie ou neige non prévue',
            unforecastDesc: "Selon le radar, il pleut ou il neige {intensity} ici, mais la prévision n'en attendait pas dans les prochaines heures.",
            extent: {
                local: ' Cela ressemble à une averse locale, qui pourrait être brève.',
                wide: ' Les précipitations couvrent une large zone alentour.'
            }
        }
    }
};

export default function RadarRealityBanner({ lat, lon, modelMmPerHourNow, forecastHours, lang, kind = 'rain' }: RadarRealityBannerProps) {
    const { hasDiscrepancy, radarMmPerHour, rainFraction } = useRadarRealityCheck(lat, lon, modelMmPerHourNow);
    const base = LOCAL_UI_TEXTS[lang] || LOCAL_UI_TEXTS.ca;
    const ui: LocalUIText = kind === 'rain' ? base : { ...base, ...(KIND_TEXTS[kind][lang] || KIND_TEXTS[kind].ca) };
    const Icon = kind === 'snow' ? CloudSnow : CloudRain;

    if (!hasDiscrepancy) return null;

    const intensity = ui.intensity[radarRainIntensity(radarMmPerHour)];
    const rainHour = firstForecastRainHour(forecastHours);
    let title: string;
    let desc: string;
    if (rainHour) {
        title = ui.earlyTitle;
        desc = ui.earlyDesc.replace('{intensity}', intensity).replace('{until}', ui.until(rainHour));
    } else {
        const extent = rainExtent(rainFraction);
        title = ui.unforecastTitle;
        desc = ui.unforecastDesc.replace('{intensity}', intensity) + (extent ? ui.extent[extent] : '');
    }

    return (
        <div className="relative flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0 bg-sky-950/90 border-sky-500/60 text-sky-100 ring-1 ring-inset ring-sky-500/20">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none bg-gradient-to-r from-sky-500 to-transparent" />
            <Icon className="w-6 h-6 shrink-0 text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)] relative z-10" />
            <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sm sm:text-base font-extrabold tracking-wide leading-tight text-sky-200">{title}</p>
                <p className="text-xs sm:text-sm mt-1 opacity-90 leading-snug">{desc}</p>
            </div>
        </div>
    );
}
