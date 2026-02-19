// src/hooks/useArome.test.ts
import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useArome } from './useArome';
import * as weatherApi from '../services/weatherApi';
import type { WeatherData } from '../types/weather';

// 1. MOCK DE L'API (Simulació)
vi.mock('../services/weatherApi', () => ({
  getAromeData: vi.fn()
}));

const mockedGetAromeData = weatherApi.getAromeData as unknown as MockedFunction<typeof weatherApi.getAromeData>;

// Interfície auxiliar per al test
interface MockAromeData {
    hourly: Record<string, number[]>;
    minutely_15: {
        precipitation?: number[];
    };
    [key: string]: unknown;
}

describe('useArome Hook', () => {
  
  // Netegem els mocks abans de cada test per no barrejar dades
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hauria d\'inicialitzar-se amb estat buit', () => {
    const { result } = renderHook(() => useArome());
    
    expect(result.current.aromeData).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('hauria de carregar dades, netejar les claus i actualitzar l\'estat (Èxit)', async () => {
    // PREPARACIÓ: Definim què retornarà l'API falsa (Dades "brutes")
    const mockRawData = {
        elevation: 100,
        hourly: {
            time: ['2023-01-01T12:00'],
            temperature_2m_meteofrance_arome_france_hd: [15.5]
        },
        minutely_15: {
            precipitation_meteofrance_arome_france_hd: [0.2]
        },
        hourly_units: {
            temperature_2m_meteofrance_arome_france_hd: '°C'
        },
        current: {},
        daily: {}
    };

    // Configurem el mock perquè retorni això quan es cridi
    mockedGetAromeData.mockResolvedValue(mockRawData as unknown as WeatherData);

    // EXECUCIÓ
    const { result } = renderHook(() => useArome());

    act(() => {
        result.current.fetchArome(41.38, 2.17);
    });

    // VERIFICACIÓ
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBeNull();

    // Assertion estricte utilitzant Record<string, unknown> en lloc d'any
    const hourlyData = result.current.aromeData?.hourly as Record<string, number[]> | undefined;
    expect(hourlyData?.temperature_2m).toBeDefined();
    expect(hourlyData?.temperature_2m[0]).toBe(15.5);
    
    // Casting segur per verificar l'estructura interna
    const data = result.current.aromeData as unknown as MockAromeData; 
    expect(data?.minutely_15?.precipitation).toBeDefined();
    expect(data?.minutely_15?.precipitation?.[0]).toBe(0.2);
  });

  it('hauria de gestionar errors de l\'API correctament', async () => {
    // PREPARACIÓ: Simulem que l'API peta
    mockedGetAromeData.mockRejectedValue(new Error('Error de Connexió'));

    const { result } = renderHook(() => useArome());

    act(() => {
        result.current.fetchArome(41.38, 2.17);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // VERIFICACIÓ
    expect(result.current.aromeData).toBeNull();
    expect(result.current.error).toBe('Error de Connexió');
  });

  it('hauria de netejar l\'estat amb clearArome', async () => {
    // Primer carreguem dades
    mockedGetAromeData.mockResolvedValue({ 
        hourly: {}, 
        minutely_15: {}, 
        hourly_units: {}, 
        elevation: 0, 
        current: {}, 
        daily: {} 
    } as unknown as WeatherData);
    
    const { result } = renderHook(() => useArome());
    
    await act(async () => {
        await result.current.fetchArome(41, 2);
    });
    
    expect(result.current.aromeData).not.toBeNull();

    // Cridem clearArome
    act(() => {
        result.current.clearArome();
    });

    expect(result.current.aromeData).toBeNull();
    expect(result.current.error).toBeNull();
  });
});