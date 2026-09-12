// src/components/RadarNowcastBanner.tsx
import { Timer } from 'lucide-react';
import { useRadarNowcastTiming } from '../hooks/useRadarNowcastTiming';
import { Language } from '../translations';

interface RadarNowcastBannerProps {
    lat?: number;
    lon?: number;
    lang: Language;
}

interface LocalUIText {
    start: string; // conté {min}
    end: string; // conté {min}
    startNow: string;
    endNow: string;
}

// [SPIKE] Diccionari propi (mateix patró que OfficialAlertBanner/RadarRealityBanner).
const LOCAL_UI_TEXTS: Record<Language, LocalUIText> = {
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
};

export default function RadarNowcastBanner({ lat, lon, lang }: RadarNowcastBannerProps) {
    const { transition } = useRadarNowcastTiming(lat, lon);
    const ui = LOCAL_UI_TEXTS[lang] || LOCAL_UI_TEXTS.ca;

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
