// src/utils/alertTime.ts
// Quan val un avís oficial i a quins dies toca. Ho fan servir la franja d'avisos de la pestanya Ara
// (OfficialAlertBanner) i el detall del dia (DayDetailModal), perquè tots dos diguin les mateixes hores.
//
// Les hores sempre a la zona horària del LLOC (la d'Open-Meteo), no a la del mòbil.
import type { Language } from '../translations';
import type { OfficialAlert } from '../services/alertsApi';

export interface AlertWhenTexts {
    /** Plantilla amb {from} i {to}. */
    range: string;
    validUntil: string;
    source: string;
}

export const ALERT_WHEN_TEXTS: Record<Language, AlertWhenTexts> = {
    ca: { range: 'De {from} a {to}', validUntil: 'Vàlida fins', source: 'Font' },
    es: { range: 'De {from} a {to}', validUntil: 'Válida hasta', source: 'Fuente' },
    en: { range: 'From {from} to {to}', validUntil: 'Valid until', source: 'Source' },
    fr: { range: 'Du {from} au {to}', validUntil: "Valable jusqu'à", source: 'Source' }
};

const LOCALE_MAP: Record<Language, string> = { ca: 'ca-ES', es: 'es-ES', en: 'en-US', fr: 'fr-FR' };

// Una zona que el navegador no coneix fa llançar Intl: llavors, la del dispositiu.
const formatSafe = (date: Date, locale: string, options: Intl.DateTimeFormatOptions, timeZone?: string): string => {
    try {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(date);
    } catch {
        return new Intl.DateTimeFormat(locale, options).format(date);
    }
};

export const validDate = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? date : null;
};

const formatExpires = (expires: string | null, lang: Language, timeZone?: string): string | null => {
    const date = validDate(expires);
    return date ? formatSafe(date, LOCALE_MAP[lang] || 'ca-ES', { dateStyle: 'short', timeStyle: 'short' }, timeZone) : null;
};

/** "dt. 18:00": dia de la setmana i hora (24 h), en l'idioma de l'app. */
const formatWeekdayTime = (date: Date, lang: Language, timeZone?: string): string => {
    const locale = LOCALE_MAP[lang] || 'ca-ES';
    const weekday = formatSafe(date, locale, { weekday: 'short' }, timeZone);
    const time = formatSafe(date, locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }, timeZone);
    return `${weekday} ${time}`;
};

/**
 * Quan val l'avís: "De dt. 18:00 a dt. 23:59" si la font en dona l'inici (Meteocat); si no, "Vàlida fins: 19/11/26 23:59".
 */
export const describeAlertWhen = (alert: OfficialAlert, lang: Language, timeZone?: string, texts?: AlertWhenTexts): string | null => {
    const ui = texts ?? ALERT_WHEN_TEXTS[lang] ?? ALERT_WHEN_TEXTS.ca;
    const onset = validDate(alert.onset);
    const expires = validDate(alert.expires);
    if (onset && expires) {
        return ui.range
            .replace('{from}', formatWeekdayTime(onset, lang, timeZone))
            .replace('{to}', formatWeekdayTime(expires, lang, timeZone));
    }
    const until = formatExpires(alert.expires, lang, timeZone);
    return until ? `${ui.validUntil}: ${until}` : null;
};

// Un avís segueix valent fins que s'acaba l'últim minut (les fonts donen 23:59).
export const isAlertStillValid = (alert: OfficialAlert, nowMs: number | undefined): boolean => {
    const expires = validDate(alert.expires);
    return nowMs === undefined || !expires || expires.getTime() + 60_000 > nowMs;
};

// [FIX] `sourceUrl` ve d'una font oficial externa (7 fonts + pas de traducció IA pel mig): un `javascript:`/`data:`
// maliciós hi executaria codi en clic. Només acceptem https.
export const isSafeExternalUrl = (url: string | null | undefined): url is string =>
    typeof url === 'string' && /^https:\/\//i.test(url);

/** "2026-11-24": la data d'un instant a la zona horària del lloc. */
export const localDateKey = (date: Date, timeZone?: string): string => {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
    try {
        return new Intl.DateTimeFormat('en-CA', { ...options, timeZone }).format(date);
    } catch {
        return new Intl.DateTimeFormat('en-CA', options).format(date);
    }
};

/**
 * Els avisos que toquen un dia ("YYYY-MM-DD" del lloc): els que encara valen i el seu tram se solapa amb el dia.
 * - Sense inici (només Meteocat el dona), l'avís compta des d'ara.
 * - Sense final no es pot saber fins quan dura: només compta per al dia on comença.
 * - Un final a les 00:00 no toca el dia que comença (es resta un minut).
 */
export const alertsForDay = (
    alerts: ReadonlyArray<OfficialAlert>,
    dayKey: string,
    timeZone: string | undefined,
    nowMs: number
): OfficialAlert[] =>
    alerts.filter(alert => {
        if (!isAlertStillValid(alert, nowMs)) return false;
        const start = validDate(alert.onset) ?? new Date(nowMs);
        const expires = validDate(alert.expires);
        const startKey = localDateKey(start, timeZone);
        const endKey = expires ? localDateKey(new Date(Math.max(start.getTime(), expires.getTime() - 60_000)), timeZone) : startKey;
        return startKey <= dayKey && dayKey <= endKey;
    });
