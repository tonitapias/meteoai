// src/components/planet/orbitalMarkers.ts
// Què es marca al disc del visor orbital, en ordre d'importància (les etiquetes es col·loquen en aquest ordre i
// les que no hi caben es deixen): els ciclons, els cinc rècords de les estacions, on és l'usuari, els incendis i
// les inundacions agrupats per país, i els volcans. La forma diu el tipus de cosa; el color, la intensitat física
// als ciclons i el tipus de rècord a les estacions (els mateixos colors que la targeta).
import type { Language } from '../../translations';
import type { WeatherUnit } from '../../utils/formatters';
import type { PlanetExtremes, StationRecord } from '../../services/planetExtremesApi';
import { countryName, type CycloneSummary } from '../../utils/planetExtremes';
import { fill, type PlanetStrings } from './planetI18n';
import { hpaText, kmhText, tempText } from './planetFormat';
import { cycloneTone } from './planetTones';

export type RecordKey = 'hottest' | 'coldest' | 'wetBulb' | 'gust' | 'lowPressure';
export type OrbitMarkerKind = 'cyclone' | 'record' | 'here' | 'fires' | 'floods' | 'volcano';

export interface MarkerColor {
    /** Traç del marcador (SVG). */
    hex: string;
    /** Text i vora de l'etiqueta. */
    text: string;
    border: string;
}

export interface OrbitMarker {
    id: string;
    kind: OrbitMarkerKind;
    record?: RecordKey;
    lat: number;
    lon: number;
    label: string;
    color: MarkerColor;
    /** Només als ciclons: per obrir-ne la fitxa. */
    cycloneId?: string;
    /** Ciclons: categoria Saffir-Simpson (el marcador creix amb la intensitat). */
    category?: number;
}

export const RECORD_COLORS: Record<RecordKey, MarkerColor> = {
    hottest: { hex: '#fb923c', text: 'text-orange-200', border: 'border-orange-400/60' },
    coldest: { hex: '#7dd3fc', text: 'text-sky-200', border: 'border-sky-300/60' },
    wetBulb: { hex: '#fbbf24', text: 'text-amber-200', border: 'border-amber-400/60' },
    gust: { hex: '#a5b4fc', text: 'text-indigo-200', border: 'border-indigo-300/60' },
    lowPressure: { hex: '#c4b5fd', text: 'text-violet-200', border: 'border-violet-300/60' },
};

const FIRE_COLOR: MarkerColor = { hex: '#fb923c', text: 'text-orange-200', border: 'border-orange-400/60' };
const FLOOD_COLOR: MarkerColor = { hex: '#fcd34d', text: 'text-amber-200', border: 'border-amber-300/60' };
const VOLCANO_COLOR: MarkerColor = { hex: '#fca5a5', text: 'text-red-200', border: 'border-red-300/60' };
const HERE_COLOR: MarkerColor = { hex: '#fde68a', text: 'text-amber-100', border: 'border-amber-200/70' };

// Els grups que es marquen a cada disc: els països amb més incendis i amb més inundacions que veu aquell ull
// (tots surten a la llista de sota; al disc, més en taparien els altres marcadors).
export const MAX_VISIBLE: Partial<Record<OrbitMarkerKind, number>> = { fires: 4, floods: 3 };

/** Deixa, de cada tipus amb límit, només els primers (ja van de més a menys esdeveniments). */
export function capPerKind<T extends { marker: OrbitMarker }>(items: T[]): T[] {
    const seen = new Map<OrbitMarkerKind, number>();
    return items.filter(({ marker }) => {
        const max = MAX_VISIBLE[marker.kind];
        if (max === undefined) return true;
        const n = (seen.get(marker.kind) ?? 0) + 1;
        seen.set(marker.kind, n);
        return n <= max;
    });
}
// Un nom d'estació més llarg no cap en una etiqueta: s'hi posa el país.
const SHORT_NAME_CHARS = 16;

const shortPlace = (record: StationRecord, lang: Language): string =>
    record.name && record.name.length <= SHORT_NAME_CHARS
        ? record.name
        : countryName(record.country, lang) ?? record.name ?? record.id;

export const cycloneLabel = (summary: CycloneSummary, s: PlanetStrings): string =>
    `${s.kinds[summary.kind]} ${summary.cyclone.name}${summary.category >= 1 ? ` · ${fill(s.catShort, { n: summary.category })}` : ''}`;

export function recordLabel(key: RecordKey, record: StationRecord, s: PlanetStrings, lang: Language, unit: WeatherUnit): string {
    switch (key) {
        case 'wetBulb': return `${tempText(record.value, unit, lang, 1)} ${s.wetBulbShort}`;
        case 'gust': return `${kmhText(record.value)} · ${shortPlace(record, lang)}`;
        case 'lowPressure': return `${hpaText(record.value)} · ${shortPlace(record, lang)}`;
        default: return `${tempText(record.value, unit, lang)} · ${shortPlace(record, lang)}`;
    }
}

interface BuildInput {
    data: PlanetExtremes;
    summaries: CycloneSummary[];
    s: PlanetStrings;
    lang: Language;
    unit: WeatherUnit;
    place: { name: string; lat: number; lon: number } | null;
}

export function buildOrbitMarkers({ data, summaries, s, lang, unit, place }: BuildInput): OrbitMarker[] {
    const markers: OrbitMarker[] = summaries.map((summary) => {
        const tone = cycloneTone(summary);
        return {
            id: `cyclone-${summary.cyclone.id}`,
            kind: 'cyclone',
            lat: summary.last.lat,
            lon: summary.last.lon,
            label: cycloneLabel(summary, s),
            color: { hex: tone.hex, text: tone.text, border: tone.border },
            cycloneId: summary.cyclone.id,
            category: summary.category,
        };
    });

    if (data.metar) {
        const records: [RecordKey, StationRecord | undefined][] = [
            ['hottest', data.metar.hottest[0]],
            ['coldest', data.metar.coldest[0]],
            ['wetBulb', data.metar.wetBulb[0]],
            ['gust', data.metar.gustKmh[0]],
            ['lowPressure', data.metar.lowPressure[0]],
        ];
        for (const [key, record] of records) {
            if (!record) continue;
            markers.push({
                id: `record-${key}`, kind: 'record', record: key, lat: record.lat, lon: record.lon,
                label: recordLabel(key, record, s, lang, unit), color: RECORD_COLORS[key],
            });
        }
    }

    // El lloc que mira l'usuari (pot no ser on és), pel seu nom.
    if (place) markers.push({ id: 'here', kind: 'here', lat: place.lat, lon: place.lon, label: place.name, color: HERE_COLOR });

    if (data.events) {
        const fireGroups = data.events.fires.byCountry.filter((c) => c.lat !== undefined && c.lon !== undefined);
        if (fireGroups.length > 0) {
            for (const group of fireGroups) {
                markers.push({
                    id: `fires-${group.country}`, kind: 'fires', lat: group.lat as number, lon: group.lon as number,
                    label: fill(s.firesAt, { place: countryName(group.country, lang) ?? group.country }), color: FIRE_COLOR,
                });
            }
        } else if (data.events.fires.largest) {
            // Un worker anterior no dona on és cada país: com a mínim, l'incendi més extens.
            const largest = data.events.fires.largest;
            markers.push({
                id: 'fires-largest', kind: 'fires', lat: largest.lat, lon: largest.lon,
                label: fill(s.firesAt, { place: countryName(largest.country, lang) ?? '—' }), color: FIRE_COLOR,
            });
        }
        for (const group of data.events.floods.byCountry.filter((c) => c.lat !== undefined && c.lon !== undefined)) {
            markers.push({
                id: `floods-${group.country}`, kind: 'floods', lat: group.lat as number, lon: group.lon as number,
                label: fill(s.floodsAt, { place: countryName(group.country, lang) ?? group.country }), color: FLOOD_COLOR,
            });
        }
        data.events.volcanoes.forEach((volcano, i) => {
            if (volcano.lat === undefined || volcano.lon === undefined) return;
            markers.push({ id: `volcano-${i}`, kind: 'volcano', lat: volcano.lat, lon: volcano.lon, label: volcano.name, color: VOLCANO_COLOR });
        });
    }

    return markers;
}
