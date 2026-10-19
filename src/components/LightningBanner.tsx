// src/components/LightningBanner.tsx
import { Zap } from 'lucide-react';
import {
    compassIndex,
    LIGHTNING_NEAR_KM,
    LIGHTNING_VERY_NEAR_KM,
    lightningMinutesAgo,
    type LightningNearby
} from '../services/lightningService';
import { Language } from '../translations';

interface LightningBannerProps {
    lightning: LightningNearby | null;
    lang: Language;
    /** Rellotge de l'app (ms): els minuts que fa l'observació avancen sense tornar a consultar. */
    now: number;
    onShowRadar: () => void;
}

interface LocalUIText {
    near: string;
    veryNear: string;
    /** {km} {dir} {min} */
    desc: string;
    intense: string;
    shelter: string;
    cta: string;
    /** Rumb de 8 punts, començant pel nord (compassIndex). */
    dirs: string[];
}

// Diccionari propi, com la resta d'avisos del radar (RadarRealityBanner).
const LOCAL_UI_TEXTS: Record<Language, LocalUIText> = {
    ca: {
        near: 'Llamps a prop',
        veryNear: 'Llamps molt a prop',
        desc: 'El satèl·lit Meteosat-12 ha detectat llamps a uns {km} km {dir}, fa {min} min.',
        intense: ' Activitat elèctrica intensa.',
        shelter: " Si ets a l'aire lliure, busca refugi en un edifici o un cotxe.",
        cta: 'Veure al radar',
        dirs: ['al nord', 'al nord-est', "a l'est", 'al sud-est', 'al sud', 'al sud-oest', "a l'oest", 'al nord-oest']
    },
    es: {
        near: 'Rayos cerca',
        veryNear: 'Rayos muy cerca',
        desc: 'El satélite Meteosat-12 ha detectado rayos a unos {km} km {dir}, hace {min} min.',
        intense: ' Actividad eléctrica intensa.',
        shelter: ' Si estás al aire libre, busca refugio en un edificio o un coche.',
        cta: 'Ver en el radar',
        dirs: ['al norte', 'al nordeste', 'al este', 'al sudeste', 'al sur', 'al suroeste', 'al oeste', 'al noroeste']
    },
    en: {
        near: 'Lightning nearby',
        veryNear: 'Lightning very close',
        desc: 'The Meteosat-12 satellite detected lightning about {km} km {dir}, {min} min ago.',
        intense: ' Intense electrical activity.',
        shelter: " If you're outdoors, take shelter in a building or a car.",
        cta: 'View on radar',
        dirs: ['to the north', 'to the north-east', 'to the east', 'to the south-east', 'to the south', 'to the south-west', 'to the west', 'to the north-west']
    },
    fr: {
        near: 'Éclairs à proximité',
        veryNear: 'Éclairs tout près',
        desc: 'Le satellite Meteosat-12 a détecté des éclairs à environ {km} km {dir}, il y a {min} min.',
        intense: ' Activité électrique intense.',
        shelter: " Si vous êtes à l'extérieur, abritez-vous dans un bâtiment ou une voiture.",
        cta: 'Voir sur le radar',
        dirs: ['au nord', 'au nord-est', "à l'est", 'au sud-est', 'au sud', 'au sud-ouest', "à l'ouest", 'au nord-ouest']
    }
};

/** Avís de llamps observats a LIGHTNING_NEAR_KM o menys (lightningService); vermell a LIGHTNING_VERY_NEAR_KM o menys. */
export default function LightningBanner({ lightning, lang, now, onShowRadar }: LightningBannerProps) {
    if (!lightning || lightning.nearestKm > LIGHTNING_NEAR_KM) return null;
    const ui = LOCAL_UI_TEXTS[lang] || LOCAL_UI_TEXTS.ca;
    const veryNear = lightning.nearestKm <= LIGHTNING_VERY_NEAR_KM;
    const desc = ui.desc
        .replace('{km}', String(lightning.nearestKm))
        .replace('{dir}', ui.dirs[compassIndex(lightning.bearingDeg)])
        .replace('{min}', String(lightningMinutesAgo(lightning, now)))
        + (lightning.intense ? ui.intense : '')
        + (veryNear ? ui.shelter : '');

    const tone = veryNear
        ? { box: 'bg-red-950/90 border-red-500/60 text-red-100 ring-red-500/20', glow: 'from-red-500', icon: 'text-red-300 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]', title: 'text-red-200', button: 'border-red-400/40 bg-red-500/15 hover:bg-red-500/25 text-red-100' }
        : { box: 'bg-amber-950/90 border-amber-500/60 text-amber-100 ring-amber-500/20', glow: 'from-amber-500', icon: 'text-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]', title: 'text-amber-200', button: 'border-amber-400/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-100' };

    return (
        <div role="status" className={`relative flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0 ring-1 ring-inset ${tone.box}`}>
            <div className={`absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none bg-gradient-to-r ${tone.glow} to-transparent`} />
            <Zap className={`w-6 h-6 shrink-0 relative z-10 ${tone.icon}`} aria-hidden="true" />
            <div className="flex-1 min-w-0 relative z-10">
                <p className={`text-sm sm:text-base font-extrabold tracking-wide leading-tight ${tone.title}`}>{veryNear ? ui.veryNear : ui.near}</p>
                <p className="text-xs sm:text-sm mt-1 opacity-90 leading-snug">{desc}</p>
                <button
                    onClick={onShowRadar}
                    className={`mt-2.5 min-h-[36px] px-3 rounded-lg border text-xs font-bold transition-colors ${tone.button}`}
                >
                    {ui.cta}
                </button>
            </div>
        </div>
    );
}
