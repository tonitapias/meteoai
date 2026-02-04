// src/components/widgets/widgetHelpers.ts
import { TRANSLATIONS, Language } from '../../translations';

// Helper de seguretat visual (evita NaNs)
export const safeVal = (val: number | null | undefined): string | number => {
    return (val !== null && val !== undefined && !isNaN(val)) ? Math.round(val) : '--';
};

// Helper de traduccions
export const getTrans = (lang: Language) => TRANSLATIONS[lang] || TRANSLATIONS['ca'];

export const getMoonPhaseText = (phase: number) => {
  if (phase < 0.03 || phase > 0.97) return "Nova";
  if (phase < 0.22) return "Creixent";
  if (phase < 0.28) return "1r Quart";
  if (phase < 0.47) return "Gibosa C.";
  if (phase < 0.53) return "Plena";
  if (phase < 0.72) return "Gibosa M.";
  if (phase < 0.78) return "3r Quart";
  return "Minvant";
};

export const timeStringToSeconds = (timeStr: string | undefined) => {
    if (!timeStr) return 0;
    const timePart = timeStr.includes('T') ? timeStr.split('T')[1].slice(0, 5) : timeStr.slice(0, 5);
    const [hours, mins] = timePart.split(':').map(Number);
    return (hours * 3600) + (mins * 60);
};

export const secondsToTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    return `${hours}:${minutes}`;
};

export const getWindDirectionText = (degrees: number) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(degrees / 45) % 8;
    return directions[index];
};