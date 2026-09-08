// src/components/OfficialAlertBanner.tsx
import { ExternalLink, ShieldAlert } from 'lucide-react';
import { useOfficialAlerts } from '../hooks/useOfficialAlerts';
import { Language } from '../translations';

interface OfficialAlertBannerProps {
    lat?: number;
    lon?: number;
    lang: Language;
}

interface LocalUIText {
    badge: string;
    source: string;
    validUntil: string;
    moreAlerts: string; // template amb {n}
}

// [SPIKE] Diccionari propi (com AIInsights): textos curts i estables, no cal
// passar-los per translations/*.ts per a un prototip.
const LOCAL_UI_TEXTS: Record<Language, LocalUIText> = {
    ca: {
        badge: 'ALERTA OFICIAL',
        source: 'Font',
        validUntil: 'Vàlida fins',
        moreAlerts: '+{n} alertes actives més'
    },
    es: {
        badge: 'ALERTA OFICIAL',
        source: 'Fuente',
        validUntil: 'Válida hasta',
        moreAlerts: '+{n} alertas activas más'
    },
    en: {
        badge: 'OFFICIAL ALERT',
        source: 'Source',
        validUntil: 'Valid until',
        moreAlerts: '+{n} more active alerts'
    },
    fr: {
        badge: 'ALERTE OFFICIELLE',
        source: 'Source',
        validUntil: "Valable jusqu'à",
        moreAlerts: '+{n} autres alertes actives'
    }
};

const LOCALE_MAP: Record<Language, string> = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };

const OfficialAlertBanner = ({ lat, lon, lang }: OfficialAlertBannerProps) => {
    const { alerts } = useOfficialAlerts(lat, lon, lang);
    const ui = LOCAL_UI_TEXTS[lang] || LOCAL_UI_TEXTS.ca;

    if (alerts.length === 0) return null;

    const top = alerts[0];
    const isSevere = top.severity === 'Extreme' || top.severity === 'Severe';
    const extraCount = alerts.length - 1;

    const expiresStr = top.expires
        ? new Intl.DateTimeFormat(LOCALE_MAP[lang] || 'ca-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(top.expires))
        : null;

    return (
        <div className={`relative flex flex-col gap-2.5 p-3.5 sm:p-4 rounded-xl border overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-500 transform-gpu translate-z-0 ${
            isSevere
                ? 'bg-rose-950/90 border-rose-500/60 text-rose-100 ring-1 ring-inset ring-rose-500/20'
                : 'bg-amber-950/90 border-amber-500/60 text-amber-100 ring-1 ring-inset ring-amber-500/20'
        }`}>
            <div className={`absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none ${isSevere ? 'bg-gradient-to-r from-rose-500 to-transparent' : 'bg-gradient-to-r from-amber-500 to-transparent'}`} />

            <div className="flex items-start gap-3.5 relative z-10">
                <ShieldAlert className={`w-6 h-6 shrink-0 ${isSevere ? 'text-rose-400 animate-pulse drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]' : 'text-amber-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.8)]'}`} />
                <div className="flex-1 min-w-0">
                    <p className="text-[10px] sm:text-xs font-mono uppercase opacity-80 tracking-widest">{ui.badge}</p>
                    <p className={`text-sm sm:text-base font-extrabold tracking-wide leading-tight mt-0.5 ${isSevere ? 'text-rose-200' : 'text-amber-200'}`}>
                        {top.event}
                    </p>
                    <p className="text-xs sm:text-sm mt-1 opacity-90 leading-snug">{top.headline}</p>
                    {expiresStr && (
                        <p className="text-[10px] sm:text-xs mt-1.5 opacity-70 font-mono">{ui.validUntil}: {expiresStr}</p>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-between gap-3 relative z-10 pl-9 sm:pl-[2.375rem]">
                <a
                    href={top.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-wide underline decoration-dotted underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
                >
                    {ui.source}: {top.senderName} <ExternalLink className="w-3 h-3" />
                </a>
                {extraCount > 0 && (
                    <span className="text-[10px] sm:text-xs font-mono opacity-70 shrink-0">
                        {ui.moreAlerts.replace('{n}', String(extraCount))}
                    </span>
                )}
            </div>
        </div>
    );
};

export default OfficialAlertBanner;
