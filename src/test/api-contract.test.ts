import { describe, it, expect } from 'vitest';

// Aquesta és la URL real que utilitza la teva app (basada en weatherApi.ts)
// He posat coordenades de Barcelona per defecte per fer la prova.
const TEST_URL = "https://api.open-meteo.com/v1/forecast?latitude=41.38&longitude=2.17&current=temperature_2m,weather_code&hourly=temperature_2m,precipitation_probability&daily=weather_code,temperature_2m_max&models=best_match&timezone=auto";

describe('Open-Meteo API Contract Check', () => {
  
  // Augmentem el timeout a 10 segons per si l'API va lenta
  it('hauria de respondre amb l\'estructura JSON esperada', async () => {
    
    // 1. Fem la petició REAL a internet
    const response = await fetch(TEST_URL);
    
    // 2. Comprovem que l'API està viva (Status 200 OK)
    expect(response.ok, `L'API ha fallat amb status: ${response.status}`).toBe(true);

    const data = await response.json();

    // 3. VALIDACIONS CRÍTIQUES (El "Contracte")
    
    // Comprovem que existeixen els blocs principals
    expect(data).toHaveProperty('current');
    expect(data).toHaveProperty('hourly');
    expect(data).toHaveProperty('daily');

    // Comprovem que els camps clau que la teva app necessita segueixen existint
    // Si Open-Meteo canvia "temperature_2m" per "temp_c", això fallarà i t'avisarà.
    
    // Validació Current
    expect(data.current).toHaveProperty('temperature_2m');
    expect(data.current).toHaveProperty('weather_code');

    // Validació Hourly (mirem que siguin arrays)
    expect(Array.isArray(data.hourly.time)).toBe(true);
    expect(Array.isArray(data.hourly.temperature_2m)).toBe(true);
    
    // Validació Daily
    expect(Array.isArray(data.daily.temperature_2m_max)).toBe(true);

    // Opcional: Imprimir èxit
    // eslint-disable-next-line no-console
    console.log("✅ Contract Test passat: L'estructura d'Open-Meteo és correcta.");
  }, 10000); // Timeout de 10s
});