import { describe, it, expect } from 'vitest';
import {
    saffirSimpsonCategory, cycloneBasin, cycloneKind, summarizeCyclone, compassIndex,
    solarTime, solarPeriod, isPolarNight, countryName, placeLabel, placeInline, wetBulbScalePct, KMH_PER_KT,
    bigCyclone, basinOcean, BIG_CYCLONE_MAX_AGE_MS, isPolarDay, isWetBulbTie, wetBulbMarginC, matchCyclone,
    cycloneAlertsWithoutTrack, africanFireShare, minutesAgo, planetProtagonist, recordRanking,
} from './planetExtremes';
import type { ActiveCyclone, GdacsAlert, PlanetExtremes, StationRecord } from '../services/planetExtremesApi';

// Trajectòria real del tifó In-fa (JTWC via NASA EONET), 23-30 d'octubre de 2026.
const IN_FA_KT = [35, 45, 45, 50, 50, 55, 65, 75, 80, 90, 115, 115, 110, 110, 105, 105, 110, 120, 130, 130, 120, 115, 120, 130, 130, 125, 125, 120, 115];
const IN_FA_POS: [number, number][] = [
    [166.1, 10.5], [166.1, 10.4], [166.1, 10.3], [166, 10.6], [165.6, 11.1], [165.3, 11.5], [165, 12.2], [164.5, 12.8], [163.9, 13.3],
    [163.3, 13.8], [163, 14], [162.7, 14.1], [162.6, 14.1], [162.4, 14.3], [162.1, 14.5], [161.6, 14.5], [160.8, 14.6], [159.9, 14.9],
    [158.9, 15.1], [157.6, 15.4], [156.3, 15.6], [154.6, 15.9], [152.9, 16.3], [151.3, 16.6], [149.7, 17.1], [147.8, 17.8], [146.2, 18.7],
    [144.5, 19.7], [143.4, 20.5],
];
const IN_FA: ActiveCyclone = {
    id: 'EONET_25728',
    name: 'In-fa',
    source: 'JTWC',
    track: IN_FA_KT.map((windKt, i) => ({
        time: new Date(Date.parse('2026-10-23T18:00:00Z') + i * 6 * 3600 * 1000).toISOString(),
        lon: IN_FA_POS[i][0],
        lat: IN_FA_POS[i][1],
        windKt,
    })),
};

describe('Escala Saffir-Simpson (vent d\'1 minut)', () => {
    it('classifica pels llindars en nusos', () => {
        expect(saffirSimpsonCategory(63)).toBe(0);
        expect(saffirSimpsonCategory(64)).toBe(1);
        expect(saffirSimpsonCategory(112)).toBe(3);
        expect(saffirSimpsonCategory(113)).toBe(4);
        expect(saffirSimpsonCategory(120)).toBe(4);
        expect(saffirSimpsonCategory(137)).toBe(5);
    });
});

describe('Conca del cicló', () => {
    it('situa els ciclons reals del 30-10-2026', () => {
        expect(cycloneBasin(20.5, 143.4)).toBe('westPacific'); // In-fa
        expect(cycloneBasin(22.6, -107.8)).toBe('eastPacific'); // Vance
        expect(cycloneBasin(16.4, 81.8)).toBe('northIndian'); // Arnab
        expect(cycloneBasin(13, -175.9)).toBe('centralPacific');
    });

    it('a l\'Amèrica Central separa el Carib del Pacífic', () => {
        expect(cycloneBasin(12.8, -87.6)).toBe('eastPacific'); // golf de Fonseca
        expect(cycloneBasin(13, -83.3)).toBe('atlantic'); // costa caribenya de Nicaragua
        expect(cycloneBasin(16, -96)).toBe('eastPacific'); // Oaxaca
        expect(cycloneBasin(20, -94)).toBe('atlantic'); // badia de Campeche
        expect(cycloneBasin(25, -75)).toBe('atlantic');
    });

    it('hemisferi sud i Mediterrani', () => {
        expect(cycloneBasin(-21, 55)).toBe('southIndian');
        expect(cycloneBasin(-15, 125)).toBe('australian');
        expect(cycloneBasin(-17, 178)).toBe('southPacific');
        expect(cycloneBasin(-17, -150)).toBe('southPacific');
        expect(cycloneBasin(-28, -48)).toBe('southAtlantic');
        expect(cycloneBasin(36, 18)).toBe('mediterranean');
    });

    it('el nom depèn de la conca i de la força', () => {
        expect(cycloneKind(120, 'westPacific')).toBe('typhoon');
        expect(cycloneKind(120, 'atlantic')).toBe('hurricane');
        expect(cycloneKind(120, 'northIndian')).toBe('cyclone');
        expect(cycloneKind(50, 'westPacific')).toBe('storm');
        expect(cycloneKind(25, 'eastPacific')).toBe('depression');
        expect(cycloneKind(40, 'mediterranean')).toBe('medicane');
    });
});

describe('Resum del tifó In-fa', () => {
    const s = summarizeCyclone(IN_FA);

    it('categoria 4 amb 115 kt ara, i pic de 130 kt', () => {
        expect(s.kind).toBe('typhoon');
        expect(s.category).toBe(4);
        expect(s.last.windKt).toBe(115);
        expect(s.peak.windKt).toBe(130);
        expect(s.peak.time).toBe('2026-10-28T06:00:00.000Z');
    });

    it('la intensificació més ràpida: +50 kt en 24 h a partir del 25 a les 06 UTC', () => {
        expect(s.maxGain24hKt).toBe(50);
        expect(s.maxGainStart?.time).toBe('2026-10-25T06:00:00.000Z');
        expect(Math.round(50 * KMH_PER_KT)).toBe(93);
    });

    it('avança cap al nord-oest a uns 24 km/h', () => {
        expect(s.motion).not.toBeNull();
        expect(s.motion!.speedKmh).toBeGreaterThan(22);
        expect(s.motion!.speedKmh).toBeLessThan(26);
        expect(compassIndex(s.motion!.bearingDeg)).toBe(7); // NO
    });

    it('ordena la trajectòria encara que arribi desordenada', () => {
        const shuffled = { ...IN_FA, track: [...IN_FA.track].reverse() };
        expect(summarizeCyclone(shuffled).last.windKt).toBe(115);
    });

    it('sense punts a 24 h exactes no hi ha guany calculable', () => {
        const short = summarizeCyclone({ ...IN_FA, track: IN_FA.track.slice(-3) });
        expect(short.maxGain24hKt).toBeNull();
    });
});

describe('«Per què aquí?»', () => {
    it('hora solar de San Miguel (El Salvador) a les 21:50 UTC', () => {
        expect(solarTime('2026-10-30T21:50:00.000Z', -88.123)).toBe('15:57');
        expect(solarTime('2026-10-30T23:00:00.000Z', 150)).toBe('09:00');
    });

    it('el moment del dia solar del lloc més calent', () => {
        expect(solarPeriod('2026-10-30T21:50:00.000Z', -88.123)).toBe('afternoon'); // San Miguel, 15:57
        expect(solarPeriod('2026-10-30T23:00:00.000Z', 139.5)).toBe('morning'); // Mount Isa, 08:18
        expect(solarPeriod('2026-10-30T12:00:00.000Z', 120)).toBe('night'); // 20:00
    });

    it('Eureka (80° N) és en nit polar a final d\'octubre; Barcelona i McMurdo no', () => {
        const date = new Date('2026-10-30T22:00:00Z');
        expect(isPolarNight(79.989, date)).toBe(true);
        expect(isPolarNight(41.4, date)).toBe(false);
        expect(isPolarNight(-77.9, date)).toBe(false);
    });

    it('noms de país en l\'idioma de l\'app', () => {
        expect(countryName('SV', 'ca')).toBe('El Salvador');
        expect(countryName('US', 'es')).toBe('Estados Unidos');
        expect(countryName(null, 'ca')).toBeNull();
        expect(placeLabel({ id: 'MSSM', name: 'San Miguel', country: 'SV' }, 'ca')).toBe('San Miguel, El Salvador');
        expect(placeLabel({ id: 'XXXX', name: null, country: null }, 'ca')).toBe('XXXX');
        expect(placeInline({ id: 'YBMA', name: 'Mount Isa', country: 'AU' }, 'ca')).toBe('Mount Isa (Austràlia)');
    });

    it('barra del bulb humit entre 20 i 37 °C', () => {
        expect(wetBulbScalePct(20)).toBe(0);
        expect(wetBulbScalePct(37)).toBe(100);
        expect(wetBulbScalePct(15)).toBe(0);
        expect(wetBulbScalePct(28)).toBeCloseTo(47.06, 1);
    });
});

describe('El fenomen gros del dia (xip de la Vista essencial)', () => {
    const lastMs = Date.parse(IN_FA.track[IN_FA.track.length - 1].time);
    const weak: ActiveCyclone = { ...IN_FA, id: 'W', name: 'Feble', track: IN_FA.track.map((p) => ({ ...p, windKt: 70 })) };

    it('tria el cicló de categoria 4 o més amb la dada recent', () => {
        expect(bigCyclone([weak, IN_FA], lastMs + 3 * 3600 * 1000)?.cyclone.name).toBe('In-fa');
    });

    it('per sota de categoria 4, o amb una dada de més de 12 h, no en treu cap', () => {
        expect(bigCyclone([weak], lastMs)).toBeNull();
        expect(bigCyclone([IN_FA], lastMs + BIG_CYCLONE_MAX_AGE_MS + 1)).toBeNull();
        expect(bigCyclone([], lastMs)).toBeNull();
    });

    it('cada conca va al seu oceà', () => {
        expect(basinOcean('westPacific')).toBe('pacific');
        expect(basinOcean('southPacific')).toBe('pacific');
        expect(basinOcean('southAtlantic')).toBe('atlantic');
        expect(basinOcean('northIndian')).toBe('indian');
        expect(basinOcean('australian')).toBe('australia');
        expect(basinOcean('mediterranean')).toBe('mediterranean');
    });
});

// --- Versió 2: empats, dia polar, alertes de GDACS i el protagonista del dia ----------------------------------
// Dades reals de l'01-11-2026 a les 20:44 UTC.
const rec = (over: Partial<StationRecord>): StationRecord => ({
    id: 'XXXX', name: 'X', country: 'CO', lat: 0, lon: 0, elevM: 10, time: '2026-11-01T20:00:00.000Z', value: 0, ...over,
});
const MONTERIA = rec({ id: 'SKMR', name: 'Monteria', lat: 8.826, lon: -75.825, elevM: 12, value: 28.7, tempC: 36, dewC: 26 });
const CHICHEN = rec({ id: 'MMCT', name: 'Chichén Itzá', country: 'MX', value: 28.1, tempC: 34, dewC: 26, time: '2026-11-01T19:44:00.000Z' });
const SOUTH_POLE = rec({ id: 'NZSP', name: 'Amundsen-South Pole', country: 'AQ', lat: -89.98, lon: 180, elevM: 2830, value: -32, time: '2026-11-01T19:50:00.000Z' });
const MURASU: GdacsAlert = { type: 'TC', level: 'red', name: 'Murasu', country: 'IN', lat: 13.6, lon: 82.6, from: '2026-11-01T00:00:00.000Z', url: 'https://www.gdacs.org/report.aspx?eventid=1001346' };
const NOW_1101 = Date.parse('2026-11-01T20:44:00Z');

interface PlanetOver {
    wetBulb?: StationRecord[];
    hottest?: StationRecord[];
    gustKmh?: StationRecord[];
    lowPressure?: StationRecord[];
    alerts?: GdacsAlert[];
    cyclones?: ActiveCyclone[];
}

const planet = (over: PlanetOver = {}): PlanetExtremes => ({
    metar: {
        updatedAt: '2026-11-01T20:44:35.000Z', stations: 4859, discarded: 11,
        hottest: over.hottest ?? [rec({ id: 'SKUC', name: 'Arauca', value: 41 })],
        coldest: [SOUTH_POLE],
        wetBulb: over.wetBulb ?? [MONTERIA, CHICHEN],
        gustKmh: over.gustKmh ?? [rec({ id: 'LIVC', name: 'Monte Cimone', country: 'IT', elevM: 2139, value: 124.1 })],
        lowPressure: over.lowPressure ?? [rec({ id: 'SCRM', name: 'Teniente Marsh', country: 'AQ', lat: -62.2, value: 974.9 })],
    },
    events: {
        updatedAt: '2026-11-01T20:44:35.000Z',
        fires: {
            count: 194,
            byCountry: [{ country: 'BW', count: 33 }, { country: 'AU', count: 27 }, { country: 'SS', count: 22 }, { country: 'TZ', count: 16 }, { country: 'NG', count: 15 }],
            largest: null,
        },
        floods: { count: 8, byCountry: [] },
        volcanoes: [],
        alerts: over.alerts ?? [],
    },
    cyclones: { updatedAt: '2026-11-01T20:44:36.000Z', cyclones: over.cyclones ?? [] },
});

describe('Empat tècnic de la calor humida', () => {
    it('amb graus sencers, cada valor té ±0,5 °C: 28,7 i 28,1 són un empat', () => {
        expect(wetBulbMarginC(MONTERIA)).toBe(0.5);
        expect(isWetBulbTie(MONTERIA, CHICHEN)).toBe(true);
        expect(isWetBulbTie(MONTERIA, rec({ value: 27.5, tempC: 33, dewC: 25 }))).toBe(false);
    });

    it('amb dècimes (estacions dels EUA), el marge és molt més petit', () => {
        const precise = rec({ value: 28.4, tempC: 33.9, dewC: 26.1 });
        expect(wetBulbMarginC(precise)).toBe(0.05);
        expect(isWetBulbTie(precise, rec({ value: 28.1, tempC: 33.3, dewC: 25.8 }))).toBe(false);
    });
});

describe('Dia polar i antiguitat de les mesures', () => {
    it("a l'inici de novembre el Pol Sud té sol les 24 hores, i Eureka (80° N) i Barcelona no", () => {
        const date = new Date('2026-11-01T20:00:00Z');
        expect(isPolarDay(-89.98, date)).toBe(true);
        expect(isPolarDay(79.99, date)).toBe(false);
        expect(isPolarDay(41.4, date)).toBe(false);
    });

    it('els minuts que fa de cada mesura, mai negatius', () => {
        expect(minutesAgo('2026-11-01T20:00:00.000Z', NOW_1101)).toBe(44);
        expect(minutesAgo('2026-11-01T21:00:00.000Z', NOW_1101)).toBe(0);
    });

    it('el rànquing de cada rècord (la ratxa és gustKmh)', () => {
        const metar = planet().metar;
        expect(metar && recordRanking(metar, 'gust')[0].name).toBe('Monte Cimone');
        expect(metar && recordRanking(metar, 'wetBulb')).toHaveLength(2);
    });
});

describe('Alertes de GDACS i ciclons', () => {
    it("lliga una alerta de cicló amb el seu cicló d'EONET pel nom", () => {
        expect(matchCyclone({ ...MURASU, name: 'In-fa' }, [IN_FA])?.id).toBe('EONET_25728');
        expect(matchCyclone(MURASU, [IN_FA])).toBeNull();
    });

    it("els ciclons amb alerta que EONET encara no té (Murasu, l'01-11) es diuen igualment", () => {
        expect(cycloneAlertsWithoutTrack([MURASU, { ...MURASU, name: 'In-fa', level: 'orange' }], [IN_FA])).toEqual([MURASU]);
    });

    it("la part dels incendis que són a l'Àfrica", () => {
        const events = planet().events;
        expect(events && africanFireShare(events.fires)).toBeCloseTo(86 / 194, 5);
        expect(africanFireShare({ count: 0, byCountry: [], largest: null })).toBe(0);
    });
});

describe('El protagonista del dia', () => {
    it("l'01-11-2026 no hi ha calor humida de perill ni cap cicló de categoria 4: el protagonista és l'alerta vermella de Murasu", () => {
        expect(planetProtagonist(planet({ alerts: [MURASU] }), NOW_1101)).toEqual({ kind: 'alert', alert: MURASU, cycloneId: null });
    });

    it('un dia sense res excepcional, cap', () => {
        expect(planetProtagonist(planet(), NOW_1101)).toBeNull();
    });

    it('la calor humida de 31 °C o més va per davant de tot', () => {
        const hot = rec({ id: 'OEDR', name: 'Dhahran', country: 'SA', value: 31.4, tempC: 36, dewC: 30 });
        expect(planetProtagonist(planet({ wetBulb: [hot], alerts: [MURASU] }), NOW_1101)).toEqual({ kind: 'wetBulb', station: hot });
    });

    it('un cicló de categoria 4 amb dada recent va per davant de les alertes', () => {
        const fresh = { ...IN_FA, track: IN_FA.track.map((p) => ({ ...p, time: new Date(Date.parse(p.time) + 2 * 86400000).toISOString() })) };
        expect(planetProtagonist(planet({ cyclones: [fresh], alerts: [MURASU] }), NOW_1101)?.kind).toBe('cyclone');
    });

    it("una alerta vermella d'un cicló que EONET sí que té porta a la seva fitxa", () => {
        expect(planetProtagonist(planet({ cyclones: [IN_FA], alerts: [{ ...MURASU, name: 'In-fa' }] }), NOW_1101)).toMatchObject({ kind: 'alert', cycloneId: 'EONET_25728' });
    });

    it('rècords físics excepcionals: 50 °C, una ratxa de 150 km/h lluny dels cims, 960 hPa', () => {
        expect(planetProtagonist(planet({ hottest: [rec({ value: 50.2 })] }), NOW_1101)).toMatchObject({ kind: 'record', record: 'hottest' });
        // La de dalt d'un cim no compta; la segona, a peu pla, sí.
        const gusts = [rec({ id: 'CIM', elevM: 2139, value: 180 }), rec({ id: 'PLA', elevM: 20, value: 155 })];
        expect(planetProtagonist(planet({ gustKmh: gusts }), NOW_1101)).toMatchObject({ kind: 'record', record: 'gust', station: { id: 'PLA' } });
        expect(planetProtagonist(planet({ lowPressure: [rec({ value: 958 })] }), NOW_1101)).toMatchObject({ kind: 'record', record: 'lowPressure' });
        expect(planetProtagonist(planet({ hottest: [rec({ value: 49 })] }), NOW_1101)).toBeNull();
    });
});
