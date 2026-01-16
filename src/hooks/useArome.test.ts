// src/hooks/useArome.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useArome } from './useArome';
import * as weatherApi from '../services/weatherApi';

// 1. MOCK DE L'API (Simulació)
// Diem a Vitest que quan algú importi weatherApi, li doni aquesta versió falsa
vi.mock('../services/weatherApi', () => ({
  getAromeData: vi.fn()
}));

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
            // Simulem la clau lletja que envia l'API real
            temperature_2m_meteofrance_arome_france_hd: [15.5]
        },
        minutely_15: {
            // Simulem dades minutades brutes
            precipitation_meteofrance_arome_france_hd: [0.2]
        },
        hourly_units: {
            temperature_2m_meteofrance_arome_france_hd: '°C'
        }
    };

    // Configurem el mock perquè retorni això quan es cridi
    (weatherApi.getAromeData as any).mockResolvedValue(mockRawData);

    // EXECUCIÓ
    const { result } = renderHook(() => useArome());

    // Cridem la funció dins d'act() perquè modifica l'estat de React
    act(() => {
        result.current.fetchArome(41.38, 2.17);
    });

    // VERIFICACIÓ
    // 1. Esperem que loading passi a true i després a false
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 2. Comprovem que no hi hagi error
    expect(result.current.error).toBeNull();

    // 3. PUNT CLAU: Comprovem que el hook ha netejat les claus "lletges"
    // Hauria de ser 'temperature_2m', NO 'temperature_2m_meteofrance...'
    expect(result.current.aromeData?.hourly.temperature_2m).toBeDefined();
    expect(result.current.aromeData?.hourly.temperature_2m[0]).toBe(15.5);
    
    // 4. Comprovem que ha capturat la física minutada
    expect(result.current.aromeData?.minutely_15.precipitation).toBeDefined();
    expect(result.current.aromeData?.minutely_15.precipitation[0]).toBe(0.2);
  });

  it('hauria de gestionar errors de l\'API correctament', async () => {
    // PREPARACIÓ: Simulem que l'API peta
    (weatherApi.getAromeData as any).mockRejectedValue(new Error('Error de Connexió'));

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
    // Primer carreguem dades (reutilitzem el mock d'èxit o posem qualsevol cosa)
    (weatherApi.getAromeData as any).mockResolvedValue({ hourly: {}, minutely_15: {}, hourly_units: {}, elevation: 0 });
    
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