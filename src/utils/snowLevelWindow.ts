// src/utils/snowLevelWindow.ts
// Finestra de cota de neu de les pròximes hores, compartida pel giny del dashboard i pel modal
// de detall: tots dos llegeixen calculations.chartDataFull (que ja comença a l'hora actual i porta
// la cadena de fallback AROME→ecmwf→gfs→icon) i així la "mínima 48 h" és la mateixa als dos llocs.

export const SNOW_LEVEL_WINDOW_HOURS = 48;

export interface SnowLevelWindowEntry {
  timeStr: string;
  snowLevel: number | null;
}

export interface SnowLevelWindow {
  entries: SnowLevelWindowEntry[];
  // Primera hora amb la cota més baixa (quan la neu arriba més avall).
  min: { idx: number; value: number } | null;
  max: number | null;
}

type SnowLevelSource = ReadonlyArray<{ time?: unknown; snowLevel?: unknown }>;

export function buildSnowLevelWindow(source: SnowLevelSource | null | undefined, hours: number = SNOW_LEVEL_WINDOW_HOURS): SnowLevelWindow {
  if (!Array.isArray(source) || source.length === 0) return { entries: [], min: null, max: null };

  const entries = source.slice(0, hours).map(e => ({
    timeStr: typeof e?.time === 'string' ? e.time : '',
    snowLevel: typeof e?.snowLevel === 'number' && !isNaN(e.snowLevel) ? e.snowLevel : null,
  }));

  let min: SnowLevelWindow['min'] = null;
  let max: number | null = null;
  for (let idx = 0; idx < entries.length; idx++) {
    const value = entries[idx].snowLevel;
    if (value === null) continue;
    if (!min || value < min.value) min = { idx, value };
    if (max === null || value > max) max = value;
  }

  return { entries, min, max };
}
