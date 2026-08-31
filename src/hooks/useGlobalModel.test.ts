// src/hooks/useGlobalModel.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGlobalModel } from './useGlobalModel';
import type { GlobalModelData } from './useGlobalModel';

// 1. MOCK DE FETCH GLOBAL (Mètode natiu de Vitest per evitar l'error TS2304)
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

describe('useGlobalModel Hook (Motor Secundari Global)', () => {
  
  // Netegem els mocks abans de cada test per evitar contaminació creuada
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('hauria d\'inicialitzar-se amb estat buit i segur', () => {
    const { result } = renderHook(() => useGlobalModel());
    
    expect(result.current.globalData).toBeNull();
    expect(result.current.loadingGlobalModel).toBe(false);
  });

  it('hauria de carregar dades, TRANSFORMAR unixtime a ISO i superar el Mur Zod', async () => {
    // PREPARACIÓ: Dades brutes de l'API (unixtime en lloc de dates text)
    const mockRawData = {
      latitude: 41.38,
      longitude: 2.17,
      hourly: {
        time: [1672574400], // Correspon a "2023-01-01T12:00:00.000Z"
        temperature_2m: [15.5],
        precipitation: [0.0],
        wind_speed_10m: [10.5],
        wind_gusts_10m: [22.0]
      }
    };

    // Simulem una resposta HTTP 200 OK usant la referència neta
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockRawData
    });

    // EXECUCIÓ
    const { result } = renderHook(() => useGlobalModel());

    act(() => {
      result.current.fetchGlobalModelByCoords(41.38, 2.17);
    });

    // VERIFICACIÓ
    await waitFor(() => expect(result.current.loadingGlobalModel).toBe(false));

    const globalData = result.current.globalData as GlobalModelData;
    expect(globalData).not.toBeNull();
    
    // VERIFICACIÓ CRÍTICA: Zod ha d'haver transformat el número a String ISO automàticament
    expect(typeof globalData.hourly.time[0]).toBe('string');
    expect(globalData.hourly.time[0]).toBe('2023-01-01T12:00:00.000Z');
    
    // Verificació de matrius tipades
    expect(globalData.hourly.temperature_2m[0]).toBe(15.5);
    expect(globalData.hourly.wind_gusts_10m?.[0]).toBe(22.0);
  });

  it('hauria de rebutjar dades corruptes (Fallada de Zod) i posar l\'estat a null', async () => {
    // Silenciem tant els errors com els avisos
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // PREPARACIÓ: Creem un objecte al qual li falta la matriu "precipitation" (obligatòria)
    const badData = {
      latitude: 41.38,
      longitude: 2.17,
      hourly: {
        time: [1672574400],
        temperature_2m: [15.5]
        // falta precipitation -> Zod ha de disparar l'alerta i bloquejar
      }
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => badData
    });

    // EXECUCIÓ
    const { result } = renderHook(() => useGlobalModel());

    act(() => {
      result.current.fetchGlobalModelByCoords(41.38, 2.17);
    });

    await waitFor(() => expect(result.current.loadingGlobalModel).toBe(false));

    // VERIFICACIÓ: L'escut ha funcionat, la dada corrupte no passa a la UI
    expect(result.current.globalData).toBeNull();

    // Restaurem les consoles
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('hauria de gestionar fallades de xarxa HTTP (!response.ok)', async () => {
    // Silenciem la consola per precaució en cas d'errors de xarxa
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // PREPARACIÓ: Simulem un error de servidor (ex. 500 Internal Server Error)
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500
    });

    const { result } = renderHook(() => useGlobalModel());

    act(() => {
      result.current.fetchGlobalModelByCoords(41.38, 2.17);
    });

    await waitFor(() => expect(result.current.loadingGlobalModel).toBe(false));

    // VERIFICACIÓ: Silencia l'error i assegura que no hi ha dades residuals
    expect(result.current.globalData).toBeNull();

    // Restaurem les consoles
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('hauria de netejar l\'estat manualment amb clearGlobalModel', async () => {
    // PREPARACIÓ: Carreguem dades vàlides primer
    const validData = {
      latitude: 0, longitude: 0,
      hourly: { time: [0], temperature_2m: [0], precipitation: [0] }
    };

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => validData
    });

    const { result } = renderHook(() => useGlobalModel());

    act(() => {
      result.current.fetchGlobalModelByCoords(0, 0);
    });

    await waitFor(() => expect(result.current.globalData).not.toBeNull());

    // EXECUCIÓ: Neteja manual
    act(() => {
      result.current.clearGlobalModel();
    });

    // VERIFICACIÓ
    expect(result.current.globalData).toBeNull();
  });
});