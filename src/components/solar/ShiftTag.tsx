// src/components/solar/ShiftTag.tsx
// "+1"/"−1" (amb text per a lectors de pantalla) quan una hora cau l'endemà o el dia anterior al dia local
// consultat (p. ex. la posta de Reykjavík a les 00:04). Compartit per l'heroi i les efemèrides.
import type { TimeText } from '../../utils/solar/solarDay';
import { MINUS } from '../../utils/solar/solarFormat';
import type { SolarStrings } from './solarI18n';

export const ShiftTag = ({ tt, t, className = '' }: { tt: TimeText | null; t: SolarStrings; className?: string }) =>
  tt && tt.shift !== 0 ? (
    <sup className={`text-[11px] text-slate-400 ${className}`}>{tt.shift > 0 ? '+1' : `${MINUS}1`}
      <span className="sr-only"> {tt.shift > 0 ? t.nextDaySr : t.prevDaySr}</span></sup>
  ) : null;
