// src/hooks/useArome.test.ts
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useArome } from './useArome';
import type { AromeData } from './useArome'; // Importem el nou tipus validat per Zod
import * as weatherApi from '../services/weatherApi';
import type { WeatherData } from '../types/weather';

// 1. MOCK DE L'API (Simulació)
vi.mock('../services/weatherApi', () => ({
  getAromeData: vi.fn()
}));

const mockedGetAromeData = weatherApi.getAromeData as unknown as MockedFunction<typeof weatherApi.getAromeData>;

describe('useArome Hook', () => {
  
  // Netegem els mocks abans de cada test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hauria d\'inicialitzar-se amb estat buit', () => {
    const { result } = renderHook(() => useArome());
    
    expect(result.current.aromeData).toBeNull();
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

    mockedGetAromeData.mockResolvedValue(mockRawData as unknown as WeatherData);

    // EXECUCIÓ
    const { result } = renderHook(() => useArome());

    act(() => {
        result.current.fetchArome(41.38, 2.17);
    });

    // VERIFICACIÓ
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Si Zod falla, l'error seria visible aquí
    expect(result.current.error).toBeNull();

    // Utilitzem el tipus real de Zod per comprovar
    const aromeData = result.current.aromeData as AromeData;
    expect(aromeData).not.toBeNull();
    
    expect(aromeData.hourly.temperature_2m).toBeDefined();
    expect(aromeData.hourly.temperature_2m?.[0]).toBe(15.5);
    
    expect(aromeData.minutely_15?.precipitation).toBeDefined();
    expect(aromeData.minutely_15?.precipitation?.[0]).toBe(0.2);
  });

  it('hauria de gestionar errors de l\'API o fallada de Zod (Out of Bounds)', async () => {
    // PREPARACIÓ: Simulem que la dada ve trencada (falta 'time') i Zod l'ha de rebutjar
    const badData = { 
        hourly: { temperature_2m: [15] } // Sense array de 'time', Zod petarà
    };
    
    mockedGetAromeData.mockResolvedValue(badData as unknown as WeatherData);

    const { result } = renderHook(() => useArome());

    act(() => {
        result.current.fetchArome(41.38, 2.17);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // VERIFICACIÓ: L'estat cau a NULL i tenim missatge d'error de seguretat
    expect(result.current.aromeData).toBeNull();
    expect(result.current.error).toBeDefined();
  });

  it('hauria de netejar l\'estat amb clearArome', async () => {
    // Carreguem una dada perfectament vàlida per a Zod
    const validData = {
        elevation: 0,
        hourly: { time: ['2023-01-01T12:00Z'] },
        minutely_15: { time: ['2023-01-01T12:00Z'] }
    };

    mockedGetAromeData.mockResolvedValue(validData as unknown as WeatherData);
    
    const { result } = renderHook(() => useArome());
    
    await act(async () => {
        await result.current.fetchArome(41, 2);
    });
    
    // Comprovem que efectivament Zod l'ha empassat
    expect(result.current.aromeData).not.toBeNull();

    // EXECUCIÓ: Neteja manual
    act(() => {
        result.current.clearArome();
    });

    // VERIFICACIÓ
    expect(result.current.aromeData).toBeNull();
    expect(result.current.error).toBeNull();
  });
});