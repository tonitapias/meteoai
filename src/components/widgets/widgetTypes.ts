// src/components/widgets/widgetTypes.ts
import React from 'react';
import { Language } from '../../translations';

// Tipus base per a qualsevol giny
export interface WidgetProps {
  lang: Language;
  // Permet propietats addicionals flexibles però manté la seguretat del 'lang'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

export interface ChartDataPoint {
  time: string;
  // DOCTRINA RISC ZERO: null quan la dada real falta — HourlyForecastWidget
  // ja renderitza "--°" per a qualsevol valor que no sigui un number vàlid.
  temp: number | null;
  icon: React.ReactNode;
  precip?: number;
  precipText?: string;
  isNow?: boolean;
}

export interface HourlyWidgetProps {
  data: ChartDataPoint[];
  lang: Language;
}

export interface VisibilityWidgetProps {
  visibility?: number | null; // Valor en metres. DOCTRINA RISC ZERO: pot faltar.
  lang: string;
}