// src/components/dashboard/PanelPlaceLine.tsx
// A dalt de Previsió, Detall i Cel (interfície per pestanyes): de quin lloc són les dades, que allà no hi ha la targeta
// principal. El nom i l'hora són els mateixos de la targeta (l'hora del lloc, calculations.shiftedNow). Cap text nou.
import { MapPin } from 'lucide-react';

interface PanelPlaceLineProps {
  name: string | null | undefined;
  /** L'hora del lloc (la de la targeta principal). */
  localTime: Date | null | undefined;
}

const hhmm = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export function PanelPlaceLine({ name, localTime }: PanelPlaceLineProps) {
  const place = typeof name === 'string' ? name.trim() : '';
  if (!place) return null;
  const time = localTime instanceof Date && !Number.isNaN(localTime.getTime()) ? hhmm(localTime) : null;

  return (
    <p className="flex min-w-0 items-center gap-2 px-1 text-sm text-slate-400">
      <MapPin aria-hidden="true" className="w-4 h-4 shrink-0 text-sky-400/80" />
      <span className="truncate font-semibold text-slate-100">{place}</span>
      {time && <span aria-hidden="true">·</span>}
      {time && <span className="shrink-0 font-mono tabular-nums">{time}</span>}
    </p>
  );
}
