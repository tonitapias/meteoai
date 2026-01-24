// src/workers/arome.worker.ts
import { injectHighResModels } from '../utils/aromeEngine';
import { ExtendedWeatherData } from '../types/weatherLogicTypes';

// Definim el tipus del missatge d'entrada
interface WorkerMessage {
  baseData: ExtendedWeatherData;
  highResData: ExtendedWeatherData | null;
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const { baseData, highResData } = e.data;
  
  try {
    // Executem la lògica pesada en aquest fil secundari
    const result = injectHighResModels(baseData, highResData);
    
    // Retornem el resultat al fil principal
    self.postMessage({ success: true, data: result });
  } catch (error) {
    self.postMessage({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};