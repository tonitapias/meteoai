// src/hooks/useRegionalModel.test.ts
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRegionalModel } from './useRegionalModel';
import type { RegionalModelData } from './useRegionalModel'; // Importem el nou tipus validat per Zod
import * as weatherApi from '../services/weatherApi';
import type { WeatherData } from '../types/weather';
import { REGIONAL_MODELS } from '../constants/regionalModels';

const AROME_MODEL = REGIONAL_MODELS.find(m => m.id === 'AROME_HD')!;

// 1. MOCK DE L'API (Simulació)
vi.mock('../services/weatherApi', () => ({
  getRegionalHDData: vi.fn()
}));

const mockedGetRegionalHDData = weatherApi.getRegionalHDData as unknown as MockedFunction<typeof weatherApi.getRegionalHDData>;

describe('useRegionalModel Hook', () => {

  // Netegem els mocks abans de cada test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hauria d\'inicialitzar-se amb estat buit', () => {
    const { result } = renderHook(() => useRegionalModel());

    expect(result.current.regionalData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('hauria de carregar dades, netejar les claus, superar Zod i actualitzar l\'estat (Èxit)', async () => {
    // PREPARACIÓ: Dades brutes d'Open-Meteo amb estructura vàlida per Zod
    const mockRawData = {
        elevation: 100,
        hourly: {
            time: ['2023-01-01T12:00:00.000Z'], // Ara enviem format ISO
            temperature_2m_meteofrance_arome_france_hd: [15.5]
        },
        minutely_15: {
            time: ['2023-01-01T12:00:00.000Z'], // Zod EXIGEIX l'array time
            precipitation_meteofrance_arome_france_hd: [0.2]
        },
        hourly_units: {
            temperature_2m_meteofrance_arome_france_hd: '°C'
        },
        current: {},
        daily: {}
    };

    mockedGetRegionalHDData.mockResolvedValue(mockRawData as unknown as WeatherData);

    // EXECUCIÓ
    const { result } = renderHook(() => useRegionalModel());

    act(() => {
        result.current.fetchRegionalModel(41.38, 2.17, AROME_MODEL);
    });

    // VERIFICACIÓ
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Si Zod falla, l'error seria visible aquí
    expect(result.current.error).toBeNull();

    // Utilitzem el tipus real de Zod per comprovar
    const regionalData = result.current.regionalData as RegionalModelData;
    expect(regionalData).not.toBeNull();

    expect(regionalData.hourly.temperature_2m).toBeDefined();
    expect(regionalData.hourly.temperature_2m?.[0]).toBe(15.5);

    expect(regionalData.minutely_15?.precipitation).toBeDefined();
    expect(regionalData.minutely_15?.precipitation?.[0]).toBe(0.2);
  });

  it('hauria de gestionar errors de l\'API o fallada de Zod (Out of Bounds)', async () => {
    // Silenciem tant els errors com els avisos (warnings) temporalment
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // PREPARACIÓ: Simulem que la dada ve trencada (falta 'time') i Zod l'ha de rebutjar
    const badData = {
        hourly: { temperature_2m: [15] } // Sense array de 'time', Zod petarà
    };

    mockedGetRegionalHDData.mockResolvedValue(badData as unknown as WeatherData);

    const { result } = renderHook(() => useRegionalModel());

    act(() => {
        result.current.fetchRegionalModel(41.38, 2.17, AROME_MODEL);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // VERIFICACIÓ: L'estat cau a NULL i tenim missatge d'error de seguretat
    expect(result.current.regionalData).toBeNull();
    expect(result.current.error).toBeDefined();

    // Restaurem les consoles
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('hauria de netejar l\'estat amb clearRegionalModel', async () => {
    // Carreguem una dada perfectament vàlida per a Zod
    const validData = {
        elevation: 0,
        hourly: { time: ['2023-01-01T12:00Z'] },
        minutely_15: { time: ['2023-01-01T12:00Z'] }
    };

    mockedGetRegionalHDData.mockResolvedValue(validData as unknown as WeatherData);

    const { result } = renderHook(() => useRegionalModel());

    await act(async () => {
        await result.current.fetchRegionalModel(41, 2, AROME_MODEL);
    });

    // Comprovem que efectivament Zod l'ha empassat
    expect(result.current.regionalData).not.toBeNull();

    // EXECUCIÓ: Neteja manual
    act(() => {
        result.current.clearRegionalModel();
    });

    // VERIFICACIÓ
    expect(result.current.regionalData).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
