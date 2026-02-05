// src/workers/arome.worker.ts

// --- CANVI: Importem la V2 (Clean Code) en lloc de la V1 ---
import { injectHighResModelsV2 } from '../utils/aromeEngineV2';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Definim el tipus del missatge d'entrada
interface WorkerMessage {
  baseData: ExtendedWeatherData;
  highResData: ExtendedWeatherData | null;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { baseData, highResData } = e.data;
  
  try {
    // --- CANVI: Executem el nou motor optimitzat ---
    // Com que els tests han demostrat paritat, això és segur.
    const result = injectHighResModelsV2(baseData, highResData);
    
    // Retornem el resultat al fil principal
    self.postMessage({ success: true, data: result });

  } catch (error) {
    // XARXA DE SEGURETAT FINAL:
    // Si la V2 peta, capturem l'error aquí.
    // El 'WeatherRepository' rebrà success:false i farà fallback a les dades base.
    // L'usuari NO veurà cap pantalla blanca.
    console.error("⚠️ AROME Worker V2 Error:", error);
    
    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};