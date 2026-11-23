// src/components/RadarNowcastBanner.tsx
import { Timer } from 'lucide-react';
import { useRadarNowcastTiming } from '../hooks/useRadarNowcastTiming';
import { Language } from '../translations';
import type { NowcastKind } from '../utils/nowcastKind';

interface RadarNowcastBannerProps {
    lat?: number;
    lon?: number;
    lang: Language;
    /**
     * Què caurà (utils/nowcastKind.ts): el radar no distingeix la pluja de la neu, ho diu el cel previst per a aquestes
     * hores. Sense, pluja.
     */
    kind?: NowcastKind;
}

interface LocalUIText {
    start: string; // conté {min}
    end: string; // conté {min}
    startNow: string;
    endNow: string;
}

// [SPIKE] Diccionari propi (mateix patró que OfficialAlertBanner/RadarRealityBanner). Un joc de frases per a la pluja,
// un per a la neu i un per quan pot ser qualsevol de les dues: a la Pica d'Estats, amb -8 °C i nevant, deia "la pluja".
const LOCAL_UI_TEXTS: Record<NowcastKind, Record<Language, LocalUIText>> = {
    rain: {
        ca: {
            start: 'Segons el radar, la pluja podria començar d\'aquí a uns {min} min.',
            end: 'Segons el radar, la pluja podria acabar d\'aquí a uns {min} min.',
            startNow: 'Segons el radar, la pluja podria estar començant ara mateix.',
            endNow: 'Segons el radar, la pluja podria estar acabant ara mateix.'
        },
        es: {
            start: 'Según el radar, la lluvia podría empezar dentro de unos {min} min.',
            end: 'Según el radar, la lluvia podría terminar dentro de unos {min} min.',
            startNow: 'Según el radar, la lluvia podría estar empezando ahora mismo.',
            endNow: 'Según el radar, la lluvia podría estar terminando ahora mismo.'
        },
        en: {
            start: 'Radar suggests rain could start in about {min} min.',
            end: 'Radar suggests rain could stop in about {min} min.',
            startNow: 'Radar suggests rain could be starting right now.',
            endNow: 'Radar suggests rain could be stopping right now.'
        },
        fr: {
            start: 'Selon le radar, la pluie pourrait commencer dans environ {min} min.',
            end: 'Selon le radar, la pluie pourrait s\'arrêter dans environ {min} min.',
            startNow: 'Selon le radar, la pluie pourrait être en train de commencer.',
            endNow: 'Selon le radar, la pluie pourrait être en train de s\'arrêter.'
        }
    },
    snow: {
        ca: {
            start: 'Segons el radar, podria començar a nevar d\'aquí a uns {min} min.',
            end: 'Segons el radar, podria parar de nevar d\'aquí a uns {min} min.',
            startNow: 'Segons el radar, podria estar començant a nevar ara mateix.',
            endNow: 'Segons el radar, podria estar parant de nevar ara mateix.'
        },
        es: {
            start: 'Según el radar, podría empezar a nevar dentro de unos {min} min.',
            end: 'Según el radar, podría dejar de nevar dentro de unos {min} min.',
            startNow: 'Según el radar, podría estar empezando a nevar ahora mismo.',
            endNow: 'Según el radar, podría estar dejando de nevar ahora mismo.'
        },
        en: {
            start: 'Radar suggests snow could start in about {min} min.',
            end: 'Radar suggests snow could stop in about {min} min.',
            startNow: 'Radar suggests snow could be starting right now.',
            endNow: 'Radar suggests snow could be stopping right now.'
        },
        fr: {
            start: 'Selon le radar, la neige pourrait commencer dans environ {min} min.',
            end: 'Selon le radar, la neige pourrait s\'arrêter dans environ {min} min.',
            startNow: 'Selon le radar, la neige pourrait être en train de commencer.',
            endNow: 'Selon le radar, la neige pourrait être en train de s\'arrêter.'
        }
    },
    mixed: {
        ca: {
            start: 'Segons el radar, la pluja o la neu podrien començar d\'aquí a uns {min} min.',
            end: 'Segons el radar, la pluja o la neu podrien acabar d\'aquí a uns {min} min.',
            startNow: 'Segons el radar, la pluja o la neu podrien estar començant ara mateix.',
            endNow: 'Segons el radar, la pluja o la neu podrien estar acabant ara mateix.'
        },
        es: {
            start: 'Según el radar, la lluvia o la nieve podrían empezar dentro de unos {min} min.',
            end: 'Según el radar, la lluvia o la nieve podrían terminar dentro de unos {min} min.',
            startNow: 'Según el radar, la lluvia o la nieve podrían estar empezando ahora mismo.',
            endNow: 'Según el radar, la lluvia o la nieve podrían estar terminando ahora mismo.'
        },
        en: {
            start: 'Radar suggests rain or snow could start in about {min} min.',
            end: 'Radar suggests rain or snow could stop in about {min} min.',
            startNow: 'Radar suggests rain or snow could be starting right now.',
            endNow: 'Radar suggests rain or snow could be stopping right now.'
        },
        fr: {
            start: 'Selon le radar, la pluie ou la neige pourraient commencer dans environ {min} min.',
            end: 'Selon le radar, la pluie ou la neige pourraient s\'arrêter dans environ {min} min.',
            startNow: 'Selon le radar, la pluie ou la neige pourraient être en train de commencer.',
            endNow: 'Selon le radar, la pluie ou la neige pourraient être en train de s\'arrêter.'
        }
    }
};

export default function RadarNowcastBanner({ lat, lon, lang, kind = 'rain' }: RadarNowcastBannerProps) {
    const { transition } = useRadarNowcastTiming(lat, lon);
    const texts = LOCAL_UI_TEXTS[kind] ?? LOCAL_UI_TEXTS.rain;
    const ui = texts[lang] || texts.ca;

    if (!transition) return null;

    const isStart = transition.type === 'start';
    const text = transition.inMinutes <= 0
        ? (isStart ? ui.startNow : ui.endNow)
        : (isStart ? ui.start : ui.end).replace('{min}', String(transition.inMinutes));

    return (
        <div className="relative flex items-center gap-3.5 p-3.5 sm:p-4 rounded-xl border overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0 bg-sky-950/90 border-sky-500/60 text-sky-100 ring-1 ring-inset ring-sky-500/20">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none bg-gradient-to-r from-sky-500 to-transparent" />
            <Timer className="w-6 h-6 shrink-0 text-sky-400 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)] relative z-10" />
            <p className="flex-1 min-w-0 text-sm sm:text-base font-bold tracking-wide leading-snug relative z-10">{text}</p>
        </div>
    );
}
