// src/components/OfficialAlertBanner.tsx
import { useState } from 'react';
import { ChevronDown, ExternalLink, ShieldAlert } from 'lucide-react';
import { useOfficialAlerts } from '../hooks/useOfficialAlerts';
import { Language } from '../translations';
import type { OfficialAlert } from '../services/alertsApi';

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
    hideAlerts: string;
}

// [SPIKE] Diccionari propi (com AIInsights): textos curts i estables, no cal
// passar-los per translations/*.ts per a un prototip.
const LOCAL_UI_TEXTS: Record<Language, LocalUIText> = {
    ca: {
        badge: 'ALERTA OFICIAL',
        source: 'Font',
        validUntil: 'Vàlida fins',
        moreAlerts: '+{n} alertes actives més',
        hideAlerts: 'Amaga les alertes addicionals'
    },
    es: {
        badge: 'ALERTA OFICIAL',
        source: 'Fuente',
        validUntil: 'Válida hasta',
        moreAlerts: '+{n} alertas activas más',
        hideAlerts: 'Ocultar las alertas adicionales'
    },
    en: {
        badge: 'OFFICIAL ALERT',
        source: 'Source',
        validUntil: 'Valid until',
        moreAlerts: '+{n} more active alerts',
        hideAlerts: 'Hide additional alerts'
    },
    fr: {
        badge: 'ALERTE OFFICIELLE',
        source: 'Source',
        validUntil: "Valable jusqu'à",
        moreAlerts: '+{n} autres alertes actives',
        hideAlerts: 'Masquer les alertes supplémentaires'
    }
};

const LOCALE_MAP: Record<Language, string> = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };

const formatExpires = (expires: string | null, lang: Language): string | null =>
    expires
        ? new Intl.DateTimeFormat(LOCALE_MAP[lang] || 'ca-ES', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(expires))
        : null;

// [FIX] `sourceUrl` ve d'una font oficial externa (7 fonts + pas de traducció
// IA pel mig) i es renderitzava directament com a `href` sense comprovar
// l'esquema: un `javascript:`/`data:` maliciós hi executaria codi en clic. Si
// la font o el Worker es veiessin compromesos, o un bug de normalització
// mangés el camp, no hi havia cap defensa. Només acceptem http(s).
const isSafeExternalUrl = (url: string | null | undefined): boolean =>
    typeof url === 'string' && /^https:\/\//i.test(url);

// Fila compacta per a les alertes que no són la principal (severitat menor):
// mateixa informació (esdeveniment, venciment, font), format reduït.
const CompactAlertRow = ({ alert, lang, ui }: { alert: OfficialAlert; lang: Language; ui: LocalUIText }) => {
    const isSevere = alert.severity === 'Extreme' || alert.severity === 'Severe';
    const expiresStr = formatExpires(alert.expires, lang);

    return (
        <div className={`flex items-start gap-2.5 py-2.5 border-t ${isSevere ? 'border-rose-500/20' : 'border-amber-500/20'}`}>
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isSevere ? 'bg-rose-400' : 'bg-amber-400'}`} />
            <div className="flex-1 min-w-0">
                <p className={`text-xs sm:text-sm font-bold leading-tight ${isSevere ? 'text-rose-200' : 'text-amber-200'}`}>
                    {alert.event}
                </p>
                <p className="text-[11px] sm:text-xs mt-0.5 opacity-80 leading-snug">{alert.headline}</p>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {expiresStr && (
                        <span className="text-[10px] font-mono opacity-60">{ui.validUntil}: {expiresStr}</span>
                    )}
                    {isSafeExternalUrl(alert.sourceUrl) ? (
                        <a
                            href={alert.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase opacity-60 hover:opacity-100 transition-opacity underline decoration-dotted underline-offset-2"
                        >
                            {ui.source}: {alert.senderName} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase opacity-60">
                            {ui.source}: {alert.senderName}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

const OfficialAlertBanner = ({ lat, lon, lang }: OfficialAlertBannerProps) => {
    const { alerts } = useOfficialAlerts(lat, lon, lang);
    const [expanded, setExpanded] = useState(false);
    const ui = LOCAL_UI_TEXTS[lang] || LOCAL_UI_TEXTS.ca;

    if (alerts.length === 0) return null;

    const top = alerts[0];
    const rest = alerts.slice(1);
    const isSevere = top.severity === 'Extreme' || top.severity === 'Severe';
    const expiresStr = formatExpires(top.expires, lang);

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
                {isSafeExternalUrl(top.sourceUrl) ? (
                    <a
                        href={top.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-wide underline decoration-dotted underline-offset-2 opacity-80 hover:opacity-100 transition-opacity"
                    >
                        {ui.source}: {top.senderName} <ExternalLink className="w-3 h-3" />
                    </a>
                ) : (
                    <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-mono uppercase tracking-wide opacity-80">
                        {ui.source}: {top.senderName}
                    </span>
                )}
                {rest.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        aria-expanded={expanded}
                        className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-mono opacity-70 hover:opacity-100 transition-opacity shrink-0"
                    >
                        {(expanded ? ui.hideAlerts : ui.moreAlerts.replace('{n}', String(rest.length)))}
                        <ChevronDown className={`w-3 h-3 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>

            {expanded && rest.length > 0 && (
                <div className="relative z-10 pl-9 sm:pl-[2.375rem]">
                    {rest.map((alert) => (
                        <CompactAlertRow key={alert.id} alert={alert} lang={lang} ui={ui} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default OfficialAlertBanner;
