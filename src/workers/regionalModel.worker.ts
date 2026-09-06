// src/workers/regionalModel.worker.ts
import { injectHighResModels } from '../utils/regionalModelEngine';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';
import type { RegionalModel } from '../constants/regionalModels';

// Definim el tipus del missatge d'entrada
interface WorkerMessage {
  baseData: ExtendedWeatherData;
  highResData: ExtendedWeatherData | null;
  model: RegionalModel;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { baseData, highResData, model } = e.data;

  try {
    const result = injectHighResModels(baseData, highResData, model);

    // Retornem el resultat al fil principal
    self.postMessage({ success: true, data: result });

  } catch (error) {
    // XARXA DE SEGURETAT FINAL:
    // Si el motor peta, capturem l'error aquí.
    // El 'WeatherRepository' rebrà success:false i farà fallback a les dades base.
    // L'usuari NO veurà cap pantalla blanca.
    console.error("⚠️ Regional Model Worker Error:", error);
    
    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};