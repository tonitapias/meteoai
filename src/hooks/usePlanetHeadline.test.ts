import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlanetHeadline, PLANET_HEADLINE_DELAY_MS, PLANET_HEADLINE_RETRY_MS } from './usePlanetHeadline';

const load = vi.fn();
vi.mock('../components/planet/planetHeadline', () => ({ loadPlanetHeadline: (...args: unknown[]) => load(...args) }));

const HEADLINE = { text: 'Tifó de categoria 4 al Pacífic', compactText: 'tifó de categoria 4 al Pacífic' };

// Deixa córrer el temps i les promeses (la importació dinàmica i la resposta).
const advance = async (ms: number) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
    });
};

describe('usePlanetHeadline', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        load.mockReset();
    });
    afterEach(() => vi.useRealTimers());

    it('no demana res fins que la previsió fa una estona que és a la pantalla', async () => {
        load.mockResolvedValue({ status: 'ready', headline: HEADLINE });
        const { result } = renderHook(() => usePlanetHeadline(true, 'ca'));
        await advance(PLANET_HEADLINE_DELAY_MS - 100);
        expect(load).not.toHaveBeenCalled();
        await advance(200);
        expect(load).toHaveBeenCalledWith('ca');
        expect(result.current).toEqual(HEADLINE);
    });

    it('a la Vista completa (o sense previsió) no demana res', async () => {
        renderHook(() => usePlanetHeadline(false, 'ca'));
        await advance(PLANET_HEADLINE_DELAY_MS * 3);
        expect(load).not.toHaveBeenCalled();
    });

    it('si el worker encara no tenia els ciclons, ho torna a provar un sol cop', async () => {
        load.mockResolvedValue({ status: 'incomplete' });
        const { result } = renderHook(() => usePlanetHeadline(true, 'ca'));
        await advance(PLANET_HEADLINE_DELAY_MS + PLANET_HEADLINE_RETRY_MS + 100);
        expect(load).toHaveBeenCalledTimes(2);
        await advance(PLANET_HEADLINE_RETRY_MS * 2);
        expect(load).toHaveBeenCalledTimes(2);
        expect(result.current).toBeNull();
    });

    it("un error de xarxa deixa la targeta com sempre", async () => {
        load.mockRejectedValue(new Error('offline'));
        const { result } = renderHook(() => usePlanetHeadline(true, 'ca'));
        await advance(PLANET_HEADLINE_DELAY_MS + 100);
        expect(result.current).toBeNull();
    });

    it("canviar d'idioma ja no espera", async () => {
        load.mockImplementation(async (lang: string) => ({ status: 'ready', headline: { ...HEADLINE, text: lang } }));
        const { result, rerender } = renderHook(({ lang }) => usePlanetHeadline(true, lang), { initialProps: { lang: 'ca' as 'ca' | 'en' } });
        await advance(PLANET_HEADLINE_DELAY_MS + 100);
        rerender({ lang: 'en' });
        await advance(10);
        expect(result.current?.text).toBe('en');
    });
});
