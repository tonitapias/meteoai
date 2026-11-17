// src/utils/countryName.ts
// El nom del país d'un lloc ve en l'idioma del moment en què es va buscar (el cercador i el GPS el demanen en l'idioma de
// l'app) i queda desat així: al lloc carregat, als favorits, a la previsió desada i al paràmetre `pais` dels enllaços. Un
// enllaç fet en català obert en castellà o en francès deia «ESPANYA» (auditoria d'UX, segona volta, A4). Aquí es busca el
// codi ISO del nom entre els noms de país dels quatre idiomes de l'app i es torna en l'idioma actual. Si no es troba
// (un nom que no és el de la llista del navegador, "Local"…), es deixa tal com és.
import type { Language } from '../translations';
import { getSafeLocale } from './formatters';

const APP_LOCALES = ['ca-ES', 'es-ES', 'en-US', 'fr-FR'];

/** Sense majúscules ni accents ni espais de més: «ESPANYA», «Espanya» i «espanya» són el mateix nom. */
const normalize = (s: string): string =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const displayNames = new Map<string, Intl.DisplayNames | null>();
const namer = (locale: string): Intl.DisplayNames | null => {
    if (!displayNames.has(locale)) {
        try {
            displayNames.set(locale, new Intl.DisplayNames([locale], { type: 'region' }));
        } catch {
            displayNames.set(locale, null); // navegador sense Intl.DisplayNames: el nom es queda com és
        }
    }
    return displayNames.get(locale) ?? null;
};

// Els codis obsolets que Intl reanomena (DD → DE, UK → GB, YU → RS…) tenen el nom del país actual: fora, o «Alemanya»
// donaria DD.
const isCanonicalRegion = (code: string): boolean => {
    try {
        return Intl.getCanonicalLocales(`und-${code}`)[0] === `und-${code}`;
    } catch {
        return true;
    }
};

let regionCodes: string[] | null = null;
const allRegionCodes = (): string[] => {
    if (!regionCodes) {
        regionCodes = [];
        for (let a = 65; a <= 90; a++) {
            for (let b = 65; b <= 90; b++) {
                const code = String.fromCharCode(a, b);
                if (isCanonicalRegion(code)) regionCodes.push(code);
            }
        }
    }
    return regionCodes;
};

// Per idioma: nom normalitzat → codi ISO. Es construeix el primer cop que cal (~680 consultes a Intl per idioma) i es
// busca primer en l'idioma de l'app: el cas normal (el nom ja hi és) no carrega les dades dels altres tres idiomes, que
// és el que costa (unes desenes de ms al primer cop).
const indexes = new Map<string, Map<string, string>>();
const indexFor = (locale: string): Map<string, string> => {
    let index = indexes.get(locale);
    if (!index) {
        index = new Map();
        const n = namer(locale);
        if (n) {
            for (const code of allRegionCodes()) {
                let name: string | undefined;
                try { name = n.of(code); } catch { continue; }
                // Un codi que el navegador no coneix torna el mateix codi.
                if (!name || name === code) continue;
                const key = normalize(name);
                if (!index.has(key)) index.set(key, code);
            }
        }
        indexes.set(locale, index);
    }
    return index;
};

// Nom normalitzat → codi (o null si no és de cap idioma): la targeta es torna a pintar sovint i no cal tornar a buscar.
const lookups = new Map<string, string | null>();

/**
 * Codi ISO 3166-1 alfa-2 d'un nom de país en català, castellà, anglès o francès; null si no se'n coneix cap.
 * `preferredLocale`: l'idioma on es busca primer.
 */
export const countryCodeFromName = (name: string | null | undefined, preferredLocale: string = APP_LOCALES[0]): string | null => {
    if (!name || !name.trim()) return null;
    const key = normalize(name);
    const known = lookups.get(key);
    if (known !== undefined) return known;
    let found: string | null = null;
    for (const locale of [preferredLocale, ...APP_LOCALES.filter((l) => l !== preferredLocale)]) {
        found = indexFor(locale).get(key) ?? null;
        if (found) break;
    }
    lookups.set(key, found);
    return found;
};

/** El nom del país en l'idioma de l'app («Espanya» en castellà → «España»); si no es reconeix, el mateix nom. */
export const localizeCountryName = (name: string | null | undefined, lang: Language): string | undefined => {
    if (!name || !name.trim()) return name ?? undefined;
    const locale = getSafeLocale(lang);
    const code = countryCodeFromName(name, locale);
    if (!code) return name;
    try {
        return namer(locale)?.of(code) ?? name;
    } catch {
        return name;
    }
};
