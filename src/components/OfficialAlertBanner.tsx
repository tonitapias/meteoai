// src/components/OfficialAlertBanner.tsx
import { useState } from 'react';
import { ChevronDown, ExternalLink, ShieldAlert } from 'lucide-react';
import { useOfficialAlerts } from '../hooks/useOfficialAlerts';
import { Language } from '../translations';
import type { OfficialAlert } from '../services/alertsApi';
import { describeAlertWhen, isAlertStillValid, isSafeExternalUrl } from '../utils/alertTime';

interface OfficialAlertBannerProps {
    lat?: number;
    lon?: number;
    lang: Language;
    /** Zona horària del lloc (Open-Meteo): les hores de l'avís, les del lloc i no les del mòbil. */
    timeZone?: string;
    /** Rellotge de l'app (ms): un avís que s'acaba mentre l'app és oberta deixa de sortir. */
    nowMs?: number;
}

interface LocalUIText {
    badge: string;
    source: string;
    validUntil: string;
    range: string; // template amb {from} i {to}
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
        range: 'De {from} a {to}',
        moreAlerts: '+{n} alertes actives més',
        hideAlerts: 'Amaga les alertes addicionals'
    },
    es: {
        badge: 'ALERTA OFICIAL',
        source: 'Fuente',
        validUntil: 'Válida hasta',
        range: 'De {from} a {to}',
        moreAlerts: '+{n} alertas activas más',
        hideAlerts: 'Ocultar las alertas adicionales'
    },
    en: {
        badge: 'OFFICIAL ALERT',
        source: 'Source',
        validUntil: 'Valid until',
        range: 'From {from} to {to}',
        moreAlerts: '+{n} more active alerts',
        hideAlerts: 'Hide additional alerts'
    },
    fr: {
        badge: 'ALERTE OFFICIELLE',
        source: 'Source',
        validUntil: "Valable jusqu'à",
        range: 'Du {from} au {to}',
        moreAlerts: '+{n} autres alertes actives',
        hideAlerts: 'Masquer les alertes supplémentaires'
    }
};

/**
 * Quan val l'avís: "De dt. 18:00 a dt. 23:59" si la font en dona l'inici (Meteocat); si no, "Vàlida fins: 19/11/26 23:59".
 * Les hores, el venciment i l'esquema segur de l'enllaç viuen a utils/alertTime.ts (també els fa servir el detall del dia).
 */
const describeWhen = (alert: OfficialAlert, lang: Language, ui: LocalUIText, timeZone?: string): string | null =>
    describeAlertWhen(alert, lang, timeZone, ui);

// Fila compacta per a les alertes que no són la principal (severitat menor):
// mateixa informació (esdeveniment, venciment, font), format reduït.
const CompactAlertRow = ({ alert, lang, ui, timeZone }: { alert: OfficialAlert; lang: Language; ui: LocalUIText; timeZone?: string }) => {
    const isSevere = alert.severity === 'Extreme' || alert.severity === 'Severe';
    const whenStr = describeWhen(alert, lang, ui, timeZone);

    return (
        <div className={`flex items-start gap-2.5 py-2.5 border-t ${isSevere ? 'border-rose-500/20' : 'border-amber-500/20'}`}>
            <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isSevere ? 'bg-rose-400' : 'bg-amber-400'}`} />
            <div className="flex-1 min-w-0">
                <p className={`text-xs sm:text-sm font-bold leading-tight ${isSevere ? 'text-rose-200' : 'text-amber-200'}`}>
                    {alert.event}
                </p>
                <p className="text-[11px] sm:text-xs mt-0.5 opacity-80 leading-snug">{alert.headline}</p>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {whenStr && (
                        <span className="text-[10px] font-mono opacity-60">{whenStr}</span>
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

const OfficialAlertBanner = ({ lat, lon, lang, timeZone, nowMs }: OfficialAlertBannerProps) => {
    const { alerts: fetched } = useOfficialAlerts(lat, lon, lang);
    const [expanded, setExpanded] = useState(false);
    const ui = LOCAL_UI_TEXTS[lang] || LOCAL_UI_TEXTS.ca;
    const alerts = fetched.filter((alert) => isAlertStillValid(alert, nowMs));

    if (alerts.length === 0) return null;

    const top = alerts[0];
    const rest = alerts.slice(1);
    const isSevere = top.severity === 'Extreme' || top.severity === 'Severe';
    const whenStr = describeWhen(top, lang, ui, timeZone);

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
                    {whenStr && (
                        <p data-testid="official-alert-when" className="text-[10px] sm:text-xs mt-1.5 opacity-70 font-mono">{whenStr}</p>
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
                        <CompactAlertRow key={alert.id} alert={alert} lang={lang} ui={ui} timeZone={timeZone} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default OfficialAlertBanner;
