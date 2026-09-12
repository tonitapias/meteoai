// src/components/RadarRealityBanner.tsx
import { CloudRain } from 'lucide-react';
import { useRadarRealityCheck } from '../hooks/useRadarRealityCheck';
import { Language } from '../translations';

interface RadarRealityBannerProps {
    lat?: number;
    lon?: number;
    modelMmPerHourNow: number;
    lang: Language;
}

interface LocalUIText {
    title: string;
    desc: string;
}

// [SPIKE] Diccionari propi (mateix patró que OfficialAlertBanner): textos curts
// i estables, no cal passar-los per translations/*.ts per a un banner petit.
const LOCAL_UI_TEXTS: Record<Language, LocalUIText> = {
    ca: {
        title: 'El radar detecta pluja que el model no preveu',
        desc: 'Hi ha activitat de precipitació just ara segons el radar Doppler, tot i que la previsió per aquest moment és pràcticament seca. Pot ser un xàfec molt localitzat.'
    },
    es: {
        title: 'El radar detecta lluvia que el modelo no prevé',
        desc: 'Hay actividad de precipitación ahora mismo según el radar Doppler, aunque la previsión para este momento es prácticamente seca. Puede ser un chubasco muy localizado.'
    },
    en: {
        title: "Radar is detecting rain the model doesn't predict",
        desc: 'There is precipitation activity right now according to Doppler radar, even though the forecast for this moment is essentially dry. This may be a very localized shower.'
    },
    fr: {
        title: 'Le radar détecte de la pluie que le modèle ne prévoit pas',
        desc: "Il y a de l'activité de précipitation en ce moment selon le radar Doppler, bien que la prévision pour cet instant soit pratiquement sèche. Cela peut être une averse très localisée."
    }
};

export default function RadarRealityBanner({ lat, lon, modelMmPerHourNow, lang }: RadarRealityBannerProps) {
    const { hasDiscrepancy } = useRadarRealityCheck(lat, lon, modelMmPerHourNow);
    const ui = LOCAL_UI_TEXTS[lang] || LOCAL_UI_TEXTS.ca;

    if (!hasDiscrepancy) return null;

    return (
        <div className="relative flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0 bg-amber-950/90 border-amber-500/60 text-amber-100 ring-1 ring-inset ring-amber-500/20">
            <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none bg-gradient-to-r from-amber-500 to-transparent" />
            <CloudRain className="w-6 h-6 shrink-0 text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)] relative z-10" />
            <div className="flex-1 min-w-0 relative z-10">
                <p className="text-sm sm:text-base font-extrabold tracking-wide leading-tight text-amber-200">{ui.title}</p>
                <p className="text-xs sm:text-sm mt-1 opacity-90 leading-snug">{ui.desc}</p>
            </div>
        </div>
    );
}
