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
  temp: number;
  icon: React.ReactNode; 
  precip?: number;
  precipText?: string;
  isNow?: boolean;
}

export interface CircularGaugeProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    max: number;
    subText?: string;
    color?: string;
}

export interface HourlyWidgetProps {
  data: ChartDataPoint[];
  lang: Language;
}

export interface VisibilityWidgetProps {
  visibility: number; // Valor en metres
  lang: string;
}