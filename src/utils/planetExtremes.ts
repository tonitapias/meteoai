// src/utils/planetExtremes.ts
// Càlculs purs de la secció «Extrems del planeta»: classificació dels ciclons tropicals a partir de la
// trajectòria de NASA EONET (vent sostingut d'1 minut del JTWC o de l'NHC, en nusos) i els fets físics que
// expliquen els rècords de les estacions («Per què aquí?»).
import { getSafeLocale } from './formatters';
import type { Language } from '../translations';
import type { ActiveCyclone, CycloneTrackPoint } from '../services/planetExtremesApi';

export const KMH_PER_KT = 1.852;

/** Pestanya amb què s'obre el detall: la dels rècords o la dels fenòmens actius. */
export type PlanetTab = 'records' | 'events';

// --- Bulb humit -------------------------------------------------------------------------------------
// Llindars fisiològics de la temperatura de bulb humit: 31 °C és el límit mesurat al laboratori per a
// joves sans (Vecellio et al. 2022, J. Appl. Physiol.); 35 °C, el límit teòric (Sherwood i Huber 2010,
// PNAS). Per sobre, el cos no pot perdre calor suant ni a l'ombra ni amb aigua.
export const WET_BULB_DANGER_C = 31;
export const WET_BULB_LIMIT_C = 35;
// Escala de la barra: de 20 °C (calor humida corrent) a 37 °C.
export const WET_BULB_SCALE_C: [number, number] = [20, 37];

export const wetBulbScalePct = (valueC: number): number => {
    const [min, max] = WET_BULB_SCALE_C;
    return Math.max(0, Math.min(100, ((valueC - min) / (max - min)) * 100));
};

// --- Ciclons tropicals ------------------------------------------------------------------------------
// Escala Saffir-Simpson, sobre el vent sostingut d'1 minut (en nusos, com la publica l'NHC). Només té
// sentit amb el vent d'1 minut: el JMA, l'IMD o Météo-France en donen el de 10 minuts, més baix.
const SAFFIR_SIMPSON_KT = [64, 83, 96, 113, 137] as const;
export const CATEGORY_THRESHOLDS_KMH = SAFFIR_SIMPSON_KT.map((kt) => kt * KMH_PER_KT);
const TROPICAL_STORM_KT = 34;
// Definició de l'NHC: 30 kt més en 24 h és intensificació ràpida.
export const RAPID_INTENSIFICATION_KT = 30;

/** 0 per sota d'huracà; 1-5 segons Saffir-Simpson. */
export const saffirSimpsonCategory = (windKt: number): number =>
    SAFFIR_SIMPSON_KT.filter((threshold) => windKt >= threshold).length;

export type CycloneBasin =
    | 'atlantic' | 'eastPacific' | 'centralPacific' | 'westPacific' | 'northIndian'
    | 'southIndian' | 'australian' | 'southPacific' | 'southAtlantic' | 'mediterranean';

/**
 * Conca a partir de la posició. Les fronteres reals són les de les àrees de responsabilitat de cada
 * centre (NHC, CPHC, JMA, IMD, Météo-France La Réunion, BoM...), aquí simplificades a la geografia: a
 * l'Amèrica Central, la línia separa la costa del Carib de la del Pacífic.
 */
export const cycloneBasin = (lat: number, lon: number): CycloneBasin => {
    if (lat >= 30 && lat <= 46 && lon >= -6 && lon <= 37) return 'mediterranean';
    if (lat < 0) {
        if (lon >= 20 && lon < 90) return 'southIndian';
        if (lon >= 90 && lon < 160) return 'australian';
        if (lon > -70 && lon < 20) return 'southAtlantic';
        return 'southPacific';
    }
    if (lon >= 100) return 'westPacific';
    if (lon >= 40) return 'northIndian';
    if (lon < -140) return 'centralPacific';
    if (lat < 18) return lon < -77 - (lat - 7) * 1.1 ? 'eastPacific' : 'atlantic';
    return lon < -100 ? 'eastPacific' : 'atlantic';
};

export type CycloneKind = 'hurricane' | 'typhoon' | 'cyclone' | 'storm' | 'depression' | 'medicane';

export const cycloneKind = (windKt: number, basin: CycloneBasin): CycloneKind => {
    if (basin === 'mediterranean') return 'medicane';
    if (windKt < TROPICAL_STORM_KT) return 'depression';
    if (windKt < SAFFIR_SIMPSON_KT[0]) return 'storm';
    if (basin === 'westPacific') return 'typhoon';
    if (basin === 'atlantic' || basin === 'eastPacific' || basin === 'centralPacific') return 'hurricane';
    return 'cyclone';
};

/**
 * Conques on el centre oficial dona el vent mitjà de 10 minuts (i, per tant, xifres més baixes que
 * les d'aquí, que són d'1 minut). Atlàntic i Pacífic oriental i central: l'NHC fa servir 1 minut.
 */
export const OFFICIAL_CENTRE: Partial<Record<CycloneBasin, { name: string; url: string; tenMinute: boolean }>> = {
    atlantic: { name: 'NHC', url: 'https://www.nhc.noaa.gov/', tenMinute: false },
    eastPacific: { name: 'NHC', url: 'https://www.nhc.noaa.gov/', tenMinute: false },
    centralPacific: { name: 'CPHC', url: 'https://www.nhc.noaa.gov/?cpac', tenMinute: false },
    westPacific: { name: 'JMA', url: 'https://www.jma.go.jp/bosai/map.html#contents=typhoon&lang=en', tenMinute: true },
    northIndian: { name: 'IMD', url: 'https://mausam.imd.gov.in/', tenMinute: true },
    southIndian: { name: 'Météo-France La Réunion', url: 'https://meteofrance.re/fr/cyclone', tenMinute: true },
    australian: { name: 'BoM', url: 'https://www.bom.gov.au/cyclone/', tenMinute: true },
    southPacific: { name: 'Fiji Meteorological Service', url: 'https://www.met.gov.fj/', tenMinute: true },
};

export interface CycloneSummary {
    cyclone: ActiveCyclone;
    last: CycloneTrackPoint;
    basin: CycloneBasin;
    kind: CycloneKind;
    category: number;
    peak: CycloneTrackPoint;
    // El guany més gran en 24 h exactes (dos punts separats 24 h) i on comença.
    maxGain24hKt: number | null;
    maxGainStart: CycloneTrackPoint | null;
    // Del penúltim a l'últim punt: velocitat (km/h) i rumb (graus, 0 = nord).
    motion: { speedKmh: number; bearingDeg: number } | null;
}

const ms = (p: CycloneTrackPoint) => Date.parse(p.time);
const DAY_MS = 24 * 3600 * 1000;

const bearingDeg = (a: CycloneTrackPoint, b: CycloneTrackPoint): number => {
    const rad = Math.PI / 180;
    const y = Math.sin((b.lon - a.lon) * rad) * Math.cos(b.lat * rad);
    const x = Math.cos(a.lat * rad) * Math.sin(b.lat * rad) - Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lon - a.lon) * rad);
    return ((Math.atan2(y, x) / rad) + 360) % 360;
};

const greatCircleKm = (a: CycloneTrackPoint, b: CycloneTrackPoint): number => {
    const rad = Math.PI / 180;
    const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2
        + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
};

export const summarizeCyclone = (cyclone: ActiveCyclone): CycloneSummary => {
    const track = [...cyclone.track].sort((a, b) => ms(a) - ms(b));
    const last = track[track.length - 1];
    const basin = cycloneBasin(last.lat, last.lon);
    const peak = track.reduce((best, p) => (p.windKt > best.windKt ? p : best), track[0]);

    let maxGain24hKt: number | null = null;
    let maxGainStart: CycloneTrackPoint | null = null;
    for (const start of track) {
        const end = track.find((p) => ms(p) - ms(start) === DAY_MS);
        if (!end) continue;
        const gain = end.windKt - start.windKt;
        if (maxGain24hKt === null || gain > maxGain24hKt) {
            maxGain24hKt = gain;
            maxGainStart = start;
        }
    }

    const previous = track.length > 1 ? track[track.length - 2] : null;
    const hours = previous ? (ms(last) - ms(previous)) / 3600000 : 0;
    const motion = previous && hours >= 3
        ? { speedKmh: greatCircleKm(previous, last) / hours, bearingDeg: bearingDeg(previous, last) }
        : null;

    return {
        cyclone: { ...cyclone, track },
        last,
        basin,
        kind: cycloneKind(last.windKt, basin),
        category: saffirSimpsonCategory(last.windKt),
        peak,
        maxGain24hKt,
        maxGainStart,
        motion,
    };
};

// --- El fenomen gros del dia (xip de la Vista essencial) ---------------------------------------------
// Només un cicló de categoria 4 o 5 justifica avisar a qui no ha obert la Vista completa. La dada ha de
// ser recent: el JTWC i l'NHC la renoven cada 6 h, i amb més de 12 h el cicló pot haver-se afeblit.
export const BIG_CYCLONE_CATEGORY = 4;
export const BIG_CYCLONE_MAX_AGE_MS = 12 * 3600 * 1000;

/** El cicló actiu més intens, si és de categoria 4 o més i la dada és recent. */
export const bigCyclone = (cyclones: ActiveCyclone[], nowMs: number): CycloneSummary | null =>
    cyclones
        .map(summarizeCyclone)
        .filter((s) => s.category >= BIG_CYCLONE_CATEGORY && nowMs - ms(s.last) <= BIG_CYCLONE_MAX_AGE_MS)
        .sort((a, b) => b.last.windKt - a.last.windKt)[0] ?? null;

/** L'oceà d'una conca, per a un text curt ("al Pacífic"). */
export type CycloneOcean = 'atlantic' | 'pacific' | 'indian' | 'australia' | 'mediterranean';

export const basinOcean = (basin: CycloneBasin): CycloneOcean => {
    switch (basin) {
        case 'atlantic': case 'southAtlantic': return 'atlantic';
        case 'northIndian': case 'southIndian': return 'indian';
        case 'australian': return 'australia';
        case 'mediterranean': return 'mediterranean';
        default: return 'pacific';
    }
};

/** 0 = N, 1 = NE ... 7 = NO. */
export const compassIndex = (deg: number): number => Math.round((((deg % 360) + 360) % 360) / 45) % 8;

// --- «Per què aquí?» ------------------------------------------------------------------------------

/** Minuts del dia en hora solar mitjana del lloc (UTC + longitud/15). */
const solarMinutes = (isoTime: string, lon: number): number => {
    const minutesUtc = (Date.parse(isoTime) / 60000) % 1440;
    return (((minutesUtc + lon * 4) % 1440) + 1440) % 1440;
};

/** Hora solar mitjana del lloc, "15:57". */
export const solarTime = (isoTime: string, lon: number): string => {
    const local = solarMinutes(isoTime, lon);
    return `${String(Math.floor(local / 60)).padStart(2, '0')}:${String(Math.floor(local % 60)).padStart(2, '0')}`;
};

/**
 * Moment del dia solar: la temperatura puja fins a mitja tarda i baixa de nit. El lloc més calent del
 * planeta pot ser-ho de matí (encara escalfarà) o de nit (l'aire conserva la calor).
 */
export const solarPeriod = (isoTime: string, lon: number): 'morning' | 'afternoon' | 'night' => {
    const hour = solarMinutes(isoTime, lon) / 60;
    if (hour >= 5 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 19) return 'afternoon';
    return 'night';
};

/** Declinació solar aproximada (graus), prou per saber si el sol surt o no. */
export const solarDeclinationDeg = (date: Date): number => {
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const dayOfYear = Math.floor((date.getTime() - start) / DAY_MS);
    return -23.44 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10));
};

/** Nit polar: el sol no arriba a l'horitzó en tot el dia (amb la refracció, -0,833°). */
export const isPolarNight = (lat: number, date: Date): boolean =>
    Math.abs(lat - solarDeclinationDeg(date)) > 90.833;

// Un cim on el vent «s'accelera»: per sota, el text de la ratxa no té res d'especial a explicar.
export const MOUNTAIN_ELEVATION_M = 1000;
// Una borrasca profunda: per sobre no cal explicar-la.
export const DEEP_LOW_HPA = 990;

// --- Noms de països ---------------------------------------------------------------------------------

const displayNamesCache = new Map<string, Intl.DisplayNames | null>();

/** Nom del país (ISO 3166-1 alfa-2) en l'idioma de l'app; si el navegador no sap fer-ho, el codi. */
export const countryName = (code: string | null, lang: Language): string | null => {
    if (!code) return null;
    const locale = getSafeLocale(lang);
    if (!displayNamesCache.has(locale)) {
        try {
            displayNamesCache.set(locale, new Intl.DisplayNames([locale], { type: 'region' }));
        } catch {
            displayNamesCache.set(locale, null);
        }
    }
    try {
        return displayNamesCache.get(locale)?.of(code) ?? code;
    } catch {
        return code;
    }
};

/** "San Miguel, El Salvador"; sense nom de l'estació, el codi OACI. */
export const placeLabel = (station: { id: string; name: string | null; country: string | null }, lang: Language): string => {
    const country = countryName(station.country, lang);
    const name = station.name ?? station.id;
    return country && country !== name ? `${name}, ${country}` : name;
};

/** Dins d'una frase: "Mount Isa (Austràlia)". */
export const placeInline = (station: { id: string; name: string | null; country: string | null }, lang: Language): string => {
    const country = countryName(station.country, lang);
    const name = station.name ?? station.id;
    return country && country !== name ? `${name} (${country})` : name;
};

export const formatInteger = (value: number, lang: Language): string =>
    Math.round(value).toLocaleString(getSafeLocale(lang));
