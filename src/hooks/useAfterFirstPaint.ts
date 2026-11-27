import { useEffect, useState } from 'react';
import { afterNextPaint } from '../utils/afterNextPaint';

/**
 * `false` al primer render i `true` en una tasca a part, quan el navegador ja ha pintat el primer frame.
 *
 * Per obrir un modal amb una part cara (el mapa de Mapbox del radar): es pinta primer la carcassa i la part cara es
 * munta després, fora del clic que l'ha obert (vegeu afterNextPaint).
 */
export function useAfterFirstPaint(): boolean {
  const [painted, setPainted] = useState(false);
  useEffect(() => afterNextPaint(() => setPainted(true)), []);
  return painted;
}
