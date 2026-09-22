import { describe, it, expect } from 'vitest';
import { calculateShortRangeAgreement } from './shortRangeAgreementRules';
import type { ExtendedWeatherData } from '../../types/weatherLogicTypes';

type Series = Array<number | null>;
type ModelSeries = { temp?: Series; precip?: Series };

const HOURS = 12;
const flat = (value: number | null, hours = HOURS): Series => Array.from({ length: hours }, () => value);

// Sèrie mostrada + ECMWF, GFS, ICON i AIFS alineats índex a índex (com normData.ts).
const build = (shown: ModelSeries, globals: ModelSeries[], hours = HOURS) => {
    const hourly = {
        temperature_2m: shown.temp ?? flat(null, hours),
        precipitation: shown.precip ?? flat(null, hours),
    };
    const models = ['ecmwf', 'gfs', 'icon', 'aifs'] as const;
    const comparison = Object.fromEntries(models.map((m, i) => [m, Array.from({ length: hours }, (_, h) => ({
        temperature_2m: globals[i]?.temp?.[h] ?? null,
        precipitation: globals[i]?.precip?.[h] ?? null,
    }))])) as unknown as ExtendedWeatherData['hourlyComparison'];
    return { hourly, comparison };
};

// Temperatura constant a totes les hores: `shown` i un valor per model global.
const agreement = (shown: number, globals: number[], start = 0) => {
    const { hourly, comparison } = build({ temp: flat(shown) }, globals.map(t => ({ temp: flat(t) })));
    return calculateShortRangeAgreement(hourly, comparison, start);
};

// Pluja per hora (mm) constant a les 6 hores: `shown` i un valor per model global. Temperatures d'acord.
const rain = (shown: number, globals: number[]) => {
    const { hourly, comparison } = build(
        { temp: flat(20), precip: flat(shown) },
        globals.map(p => ({ temp: flat(20), precip: flat(p) }))
    );
    return calculateShortRangeAgreement(hourly, comparison, 0);
};

describe('calculateShortRangeAgreement — temperatura de les pròximes 6 h', () => {
    it("models d'acord amb el que es mostra: alta", () => {
        expect(agreement(20, [20.3, 19.8, 20.1, 20.2])?.level).toBe('high');
    });

    it('un sol model global desviat de la resta (biaix fix de graella) no fa saltar el vermell', () => {
        // Cas típic de l'aeroport de Barcelona: el que es mostra coincideix amb la majoria.
        expect(agreement(20, [20, 23, 20, 20])?.level).toBe('high');
        expect(agreement(20, [20, 23.5, 20, 20])?.level).toBe('medium');
    });

    it('una discrepància gran entre models és incertesa alta, i el valor és el rang mitjà', () => {
        const result = agreement(20, [20, 27, 20, 20]);
        expect(result?.level).toBe('low');
        expect(result?.type).toBe('temp');
        expect(result?.value).toBe(7);
    });

    it("si el que es mostra va per lliure respecte de tots els globals, també compta (tot i que els globals estiguin d'acord)", () => {
        expect(agreement(20, [22.5, 22.5, 22.5, 22.5])?.level).toBe('medium');
        expect(agreement(20, [23, 23, 23, 23])?.level).toBe('low');
    });

    it("només mira les 6 hores que comencen a l'hora actual, no les passades", () => {
        const shown = [...flat(20, 6), ...flat(15, 6)];
        const wild = [...flat(30, 6), ...flat(15.2, 6)];
        const { hourly, comparison } = build({ temp: shown }, [{ temp: wild }, { temp: wild }, { temp: flat(15, 12) }, { temp: flat(15.1, 12) }]);
        expect(calculateShortRangeAgreement(hourly, comparison, 0)?.level).toBe('low');
        expect(calculateShortRangeAgreement(hourly, comparison, 6)?.level).toBe('high');
    });
});

describe('calculateShortRangeAgreement — pluja de les pròximes 6 h', () => {
    it('tots secs: alta', () => {
        expect(rain(0, [0, 0, 0, 0])?.level).toBe('high');
    });

    it('la mitjana i la baixa depenen de quants globals contradiuen el que es mostra (1/4 alta, 2/4 mitjana, 3/4 baixa)', () => {
        expect(rain(0, [0.5, 0, 0, 0])?.level).toBe('high');
        expect(rain(0, [0.5, 0.5, 0, 0])?.level).toBe('medium');
        const low = rain(0, [0.5, 0.5, 0.5, 0]);
        expect(low?.level).toBe('low');
        expect(low?.type).toBe('precip');
        expect(low?.value).toBe(0.75);
    });

    it('si es mostra pluja i cap global en dona, és incertesa alta', () => {
        expect(rain(1, [0, 0, 0, 0])?.level).toBe('low');
        expect(rain(1, [1, 1, 1, 1])?.level).toBe('high');
    });

    it('el llindar de pluja és 0,3 mm en les 6 hores', () => {
        expect(rain(0, [0.05, 0.05, 0.05, 0])?.level).toBe('low');     // 0,3 mm: plou
        expect(rain(0, [0.04, 0.04, 0.04, 0])?.level).toBe('high');    // 0,24 mm: sec
    });
});

describe('calculateShortRangeAgreement — dades absents (sense insígnia, mai una de fingida)', () => {
    it('sense sèrie horària o sense comparació de models: null', () => {
        const { hourly, comparison } = build({ temp: flat(20) }, [{ temp: flat(20) }, { temp: flat(20) }]);
        expect(calculateShortRangeAgreement(null, comparison, 0)).toBeNull();
        expect(calculateShortRangeAgreement(hourly, null, 0)).toBeNull();
        expect(calculateShortRangeAgreement(hourly, comparison, -1)).toBeNull();
    });

    it('amb un sol model global no hi ha comparació: null', () => {
        expect(agreement(20, [26])).toBeNull();
    });

    it('amb dos models globals ja es compara', () => {
        expect(agreement(20, [20.2, 19.9])?.level).toBe('high');
    });

    it('amb menys de 4 hores vàlides a la finestra: null (p. ex. al final de la previsió)', () => {
        const { hourly, comparison } = build({ temp: flat(20, 3) }, [{ temp: flat(26, 3) }, { temp: flat(20, 3) }], 3);
        expect(calculateShortRangeAgreement(hourly, comparison, 0)).toBeNull();
    });

    it('sense temperatura mostrada però amb pluja comparable, decideix la pluja', () => {
        const { hourly, comparison } = build({ precip: flat(0) }, [{ precip: flat(0.5) }, { precip: flat(0.5) }, { precip: flat(0.5) }, { precip: flat(0) }]);
        expect(calculateShortRangeAgreement(hourly, comparison, 0)?.level).toBe('low');
    });

    it('una hora sense dada de pluja no compta com 0 mm, però amb 4 hores reals ja es compara', () => {
        const shown = [0, 0, null, null, 0, 0, 0, 0];
        const wet = [1, 1, 1, 1, 1, 1, 1, 1];
        const { hourly, comparison } = build({ temp: flat(20, 8), precip: shown }, [{ temp: flat(20, 8), precip: wet }, { temp: flat(20, 8), precip: wet }, { temp: flat(20, 8), precip: wet }], 8);
        expect(calculateShortRangeAgreement(hourly, comparison, 0)?.level).toBe('low');
    });
});
